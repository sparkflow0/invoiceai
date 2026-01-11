export type StepType = "system_action" | "user_action" | "terminal";

export interface WorkflowStep {
    type: StepType;
    action?: string;
    nextStep?: string;
    role?: string;
    actions?: Record<string, string>;
    status?: string;
}

export interface WorkflowDefinition {
    id: string;
    name: string;
    version: string;
    initialStep: string;
    steps: Record<string, WorkflowStep>;
}
