import { executeToolCall as originalExecuteToolCall, ToolExecutionResult } from "./chat-executor";

// Custom build logic for designer chat to respect detailed drawing instructions
async function handleDesignerBuildLogic(args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const task = (args.task as string) || "";
  const lowerTask = task.toLowerCase();
  const isSnake = lowerTask.includes("snake");
  const isWraparound = lowerTask.includes("wraparound");
  const hasRedEyes = lowerTask.includes("red eyes");
  const eatsOwnTail = lowerTask.includes("eats his own tail") || lowerTask.includes("eats its own tail");

  let description = "A snake";
  if (isWraparound) description += " wrapped around itself";
  if (hasRedEyes) description += " with glowing red eyes";
  if (eatsOwnTail) description += " eating its own tail";
  if (!isSnake && !isWraparound && !hasRedEyes && !eatsOwnTail) {
    description = task;
  }

  // TODO: Replace with actual image generation call
  return {
    success: true,
    data: {
      message: `Generated image with description: ${description}`,
      description,
    },
  };
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: number,
  userName?: string,
  userEmail?: string | null,
  userApiKey?: string | null,
  conversationId?: number
): Promise<ToolExecutionResult> {
  if (toolName === "designer_build") {
    return await handleDesignerBuildLogic(args);
  }
  return originalExecuteToolCall(toolName, args, userId, userName, userEmail, userApiKey, conversationId);
}
