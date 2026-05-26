"""
Workflow module — turns raw owner evidence (voice/photo/text) into executable
structured workflows that part-timers run on their phones.

# CORE_CANDIDATE — this is the load-bearing pillar of the SMB platform.

Three submodules planned:
- inference: raw evidence → WorkflowDefinition (this file ships first)
- execution: track WorkExecution instances when a worker runs through a workflow
- verification: AI-judge photo/voice evidence against a Step's verification spec

Right now only inference is implemented.
"""

from core.workflow.inference import infer_workflow
from core.workflow.schemas import (
    Step,
    Verification,
    VerificationType,
    WorkflowDefinition,
    WorkflowInferenceInput,
    WorkflowInferenceResult,
)

__all__ = [
    "Step",
    "Verification",
    "VerificationType",
    "WorkflowDefinition",
    "WorkflowInferenceInput",
    "WorkflowInferenceResult",
    "infer_workflow",
]
