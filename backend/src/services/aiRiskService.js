import db from '../utils/db.js';

/**
 * AI Risk Analysis Service
 * 
 * Architecture: Microservice-style layer within PERN monolith
 * - Isolates ALL AI logic from controllers (clean separation)
 * - Handles data aggregation, AI inference, and response parsing
 * - Supports caching to minimize redundant AI calls
 * 
 * AI Provider: Google Gemini API (Free Tier)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const GEMINI_CONFIG = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', 
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  timeout: 60000, // 60 seconds for API call
};

const CACHE_DURATION_HOURS = 24;

// ============================================================================
// SYSTEM PROMPT FOR AI INFERENCE
// ============================================================================

/**
 * System prompt instructs Llama 3.1 to act as a Senior Project Manager
 * and return ONLY valid JSON for risk assessment
 */
const SYSTEM_PROMPT = `You are a Senior Project Manager with 15+ years of experience in risk assessment and team management. Your task is to analyze project health data and predict risks.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON - no markdown, no explanations, no extra text
2. Analyze the project context objectively based on the data provided
3. Consider: deadline pressure, task completion rate, overdue items, team workload distribution, and urgent task density

RESPONSE FORMAT (strict JSON only):
{
  "risk_score": <number 0-100>,
  "risk_level": "<Low|Medium|High|Critical>",
  "summary": "<2-3 sentence executive summary>",
  "risk_factors": [
    {"factor": "<description>", "severity": "<low|medium|high|critical>"}
  ],
  "suggested_actions": [
    "<actionable recommendation>"
  ]
}

RISK SCORE GUIDELINES:
- 0-25: Low risk - Project on track, minor issues only
- 26-50: Medium risk - Some concerns need attention
- 51-75: High risk - Significant issues threatening success
- 76-100: Critical risk - Immediate intervention required

Analyze the following project context and respond with JSON only:`;

// ============================================================================
// DATA AGGREGATION (Summarize raw data before AI inference)
// ============================================================================

/**
 * Gathers and aggregates project context for AI analysis
 * Minimizes prompt size by pre-computing statistics
 * 
 * @param {number} projectId - Project ID to analyze
 * @returns {Promise<Object>} Aggregated project context
 */
export const gatherProjectContext = async (projectId) => {
  // 1. Retrieve Project information
  const [project] = await db`
    SELECT id, name, description, status, start_date, end_date, created_at
    FROM projects WHERE id = ${projectId}
  `;

  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  // 2. Retrieve all Tasks for the project
  const tasks = await db`
    SELECT id, title, status, priority, due_date
    FROM tasks WHERE project_id = ${projectId}
  `;

  // 3. Compute task statistics
  const now = new Date();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const overdueTasks = tasks.filter(t => 
    t.due_date && new Date(t.due_date) < now && t.status !== 'done'
  ).length;
  const urgentTasks = tasks.filter(t => 
    t.priority === 'urgent' && t.status !== 'done'
  ).length;
  const highPriorityTasks = tasks.filter(t => 
    t.priority === 'high' && t.status !== 'done'
  ).length;

  // Task breakdown by status
  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: completedTasks,
  };

  // 4. Calculate Workload Per Member (Burnout Detection)
  const workloadRows = await db`
    SELECT u.username, t.priority
    FROM task_assignees ta
    JOIN tasks t ON ta.task_id = t.id
    JOIN users u ON ta.user_id = u.id
    WHERE t.project_id = ${projectId} AND t.status != 'done'
  `;

  const memberWorkloads = {};
  workloadRows.forEach(row => {
    if (!memberWorkloads[row.username]) {
      memberWorkloads[row.username] = { total: 0, urgent: 0, high: 0 };
    }
    memberWorkloads[row.username].total++;
    if (row.priority === 'urgent') memberWorkloads[row.username].urgent++;
    if (row.priority === 'high') memberWorkloads[row.username].high++;
  });

  // 5. Calculate timeline metrics
  const daysRemaining = project.end_date
    ? Math.ceil((new Date(project.end_date) - now) / (1000 * 60 * 60 * 24))
    : null;

  const progressPercent = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // 6. Return aggregated context object
  return {
    projectName: project.name,
    projectStatus: project.status,
    deadline: project.end_date,
    daysRemaining,
    totalTasks,
    completedTasks,
    progressPercent,
    tasksByStatus,
    overdueCount: overdueTasks,
    urgentPendingCount: urgentTasks,
    highPriorityPendingCount: highPriorityTasks,
    memberWorkloads,
    teamSize: Object.keys(memberWorkloads).length,
    analyzedAt: now.toISOString(),
  };
};

// ============================================================================
// GOOGLE GEMINI API INTEGRATION
// ============================================================================

/**
 * Calls Google Gemini API with the project context for inference
 * Uses gemini-2.5-flash (free tier) for cost-effective analysis
 * 
 * @param {Object} context - Aggregated project context
 * @returns {Promise<Object>} Parsed AI response
 */
export const callGeminiAPI = async (context) => {
  if (!GEMINI_CONFIG.apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const prompt = formatContextForPrompt(context);
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;

  const requestBody = {
    contents: [{
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      temperature: 0.3, // Lower temperature for consistent JSON output
      maxOutputTokens: 1024,
      responseMimeType: 'application/json', // Request JSON response
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_CONFIG.timeout);

    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Extract text from Gemini response structure
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    return parseAIResponse(responseText);

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Gemini API timeout - request took too long');
    }
    throw new Error(`Gemini API failed: ${error.message}`);
  }
};

/**
 * Formats project context into a readable prompt for the AI
 */
const formatContextForPrompt = (context) => {
  const workloadSummary = Object.entries(context.memberWorkloads)
    .map(([name, load]) => `  - ${name}: ${load.total} tasks (${load.urgent} urgent, ${load.high} high)`)
    .join('\n') || '  No active assignments';

  return `
PROJECT: ${context.projectName}
STATUS: ${context.projectStatus}
DEADLINE: ${context.deadline || 'Not set'} (${context.daysRemaining !== null ? context.daysRemaining + ' days remaining' : 'N/A'})

TASK METRICS:
- Total Tasks: ${context.totalTasks}
- Completed: ${context.completedTasks} (${context.progressPercent}%)
- Overdue: ${context.overdueCount}
- Urgent Pending: ${context.urgentPendingCount}
- High Priority Pending: ${context.highPriorityPendingCount}

STATUS BREAKDOWN:
- To Do: ${context.tasksByStatus.todo}
- In Progress: ${context.tasksByStatus.in_progress}
- In Review: ${context.tasksByStatus.review}
- Done: ${context.tasksByStatus.done}

TEAM WORKLOAD (${context.teamSize} members):
${workloadSummary}
`.trim();
};

/**
 * Parses and validates AI response JSON
 * Handles malformed responses gracefully
 */
const parseAIResponse = (responseText) => {
  // Try to extract JSON from response (handle markdown code blocks)
  let jsonStr = responseText.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (typeof parsed.risk_score !== 'number' || parsed.risk_score < 0 || parsed.risk_score > 100) {
      throw new Error('Invalid risk_score');
    }
    if (!['Low', 'Medium', 'High', 'Critical'].includes(parsed.risk_level)) {
      throw new Error('Invalid risk_level');
    }
    if (typeof parsed.summary !== 'string') {
      throw new Error('Invalid summary');
    }

    return {
      riskScore: Math.round(parsed.risk_score),
      riskLevel: parsed.risk_level,
      summary: parsed.summary,
      riskFactors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors : [],
      suggestedActions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
    };

  } catch (parseError) {
    console.error('Failed to parse AI response:', responseText);
    throw new Error(`AI response parsing failed: ${parseError.message}`);
  }
};

// ============================================================================
// FALLBACK: Rule-Based Risk Calculation (when AI provider (Gemini) is unavailable)
// ============================================================================

/**
 * Calculates risk using heuristics when AI is unavailable
 */
export const calculateRiskFallback = (context) => {
  let riskScore = 0;
  const riskFactors = [];
  const suggestedActions = [];

  // Factor 1: Overdue tasks
  if (context.overdueCount > 0) {
    const impact = Math.min(context.overdueCount * 10, 30);
    riskScore += impact;
    riskFactors.push({
      factor: `${context.overdueCount} overdue task(s)`,
      severity: context.overdueCount >= 3 ? 'high' : 'medium',
    });
    suggestedActions.push(`Address ${context.overdueCount} overdue tasks immediately`);
  }

  // Factor 2: Urgent tasks pending
  if (context.urgentPendingCount > 0) {
    const impact = Math.min(context.urgentPendingCount * 8, 24);
    riskScore += impact;
    riskFactors.push({
      factor: `${context.urgentPendingCount} urgent task(s) pending`,
      severity: context.urgentPendingCount >= 2 ? 'high' : 'medium',
    });
    suggestedActions.push(`Prioritize ${context.urgentPendingCount} urgent tasks`);
  }

  // Factor 3: Deadline pressure
  if (context.daysRemaining !== null) {
    if (context.daysRemaining < 0) {
      riskScore += 25;
      riskFactors.push({
        factor: `Deadline passed ${Math.abs(context.daysRemaining)} days ago`,
        severity: 'critical',
      });
      suggestedActions.push('Immediately reassess timeline with stakeholders');
    } else if (context.daysRemaining <= 3 && context.progressPercent < 80) {
      riskScore += 20;
      riskFactors.push({
        factor: `Only ${context.daysRemaining} days left with ${context.progressPercent}% complete`,
        severity: 'high',
      });
      suggestedActions.push('Consider scope reduction or deadline extension');
    }
  }

  // Factor 4: Team overload
  Object.entries(context.memberWorkloads).forEach(([username, workload]) => {
    if (workload.total >= 8) {
      riskScore += 10;
      riskFactors.push({
        factor: `${username} overloaded with ${workload.total} tasks`,
        severity: 'high',
      });
      suggestedActions.push(`Redistribute tasks from ${username}`);
    }
  });

  // Factor 5: Stalled project
  if (context.totalTasks > 0 && context.progressPercent < 10 && context.tasksByStatus.in_progress === 0) {
    riskScore += 15;
    riskFactors.push({
      factor: 'Project stalled - no tasks in progress',
      severity: 'high',
    });
    suggestedActions.push('Schedule kickoff meeting to begin task execution');
  }

  riskScore = Math.min(riskScore, 100);

  // Determine risk level
  let riskLevel;
  if (riskScore <= 25) riskLevel = 'Low';
  else if (riskScore <= 50) riskLevel = 'Medium';
  else if (riskScore <= 75) riskLevel = 'High';
  else riskLevel = 'Critical';

  const summary = `Project "${context.projectName}" has ${riskFactors.length} risk factor(s). Progress: ${context.progressPercent}% complete with ${context.overdueCount} overdue tasks.`;

  return { riskScore, riskLevel, summary, riskFactors, suggestedActions };
};

// ============================================================================
// MAIN ENTRY POINT: Analyze Project Risk
// ============================================================================

/**
 * Main function to analyze project risk using Google Gemini API
 * Falls back to rule-based calculation if AI is unavailable
 * 
 * @param {number} projectId - Project to analyze
 * @param {boolean} useAI - Whether to use AI inference (default: true)
 * @returns {Promise<Object>} Risk assessment with context
 */
export const analyzeProjectRisk = async (projectId, useAI = true) => {
  // Step 1: Aggregate project data
  const context = await gatherProjectContext(projectId);

  // Step 2: Perform analysis
  let analysis;

  if (useAI) {
    try {
      analysis = await callGeminiAPI(context);
      console.log(`Gemini AI inference successful for project ${projectId}`);
    } catch (error) {
      console.warn(`Gemini API failed, using fallback: ${error.message}`);
      analysis = calculateRiskFallback(context);
    }
  } else {
    analysis = calculateRiskFallback(context);
  }

  // Step 3: Return combined result
  return {
    ...analysis,
    context, // Include for storage/debugging
  };
};

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Checks if a cached report is still valid
 */
export const isCacheValid = (report) => {
  if (!report) return false;
  const reportAge = Date.now() - new Date(report.created_at).getTime();
  const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;
  return reportAge < maxAge;
};

export default {
  gatherProjectContext,
  callGeminiAPI,
  calculateRiskFallback,
  analyzeProjectRisk,
  isCacheValid,
  SYSTEM_PROMPT,
};
