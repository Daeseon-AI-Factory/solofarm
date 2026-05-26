"""
Pydantic schemas for workflow definitions and inference inputs/outputs.

These are the data structures the rest of the platform builds around:
- WorkflowDefinition is what gets stored, shown to the owner as a flowchart,
  and executed by part-timers.
- WorkflowInferenceInput is the raw evidence the owner provides (already
  transcribed/described by upstream Whisper + Vision layers).
- WorkflowInferenceResult is what core/workflow/inference produces.
"""

from enum import Enum

from pydantic import BaseModel, Field


class VerificationType(str, Enum):
    """How a Step's completion is confirmed by the worker."""

    PHOTO = "photo"  # worker uploads a photo, AI judges if the work was done
    VOICE = "voice"  # worker records a voice note with specific data to capture
    NONE = "none"  # worker self-confirms by tapping done; used for trivial steps


class Verification(BaseModel):
    """Spec for confirming a Step is complete."""

    type: VerificationType

    # PHOTO only: a natural-language criterion the AI checks against the image.
    # Example: "espresso machine surface has no coffee residue visible."
    ai_check: str | None = None

    # VOICE only: fields the worker should mention in the voice note.
    # Example: ["cash_total_krw", "card_total_krw"] → AI extracts both numbers
    # from the worker's transcribed voice note.
    captures: list[str] | None = None


class Step(BaseModel):
    """A single unit of work in a workflow."""

    order: int  # 1-based position in the sequence
    name: str  # short label shown to the worker ("에스프레소 머신 청소")
    description: str  # one sentence with enough detail for a new worker
    duration_estimate_minutes: int = 5
    verification: Verification | None = None  # None == self-confirm


class WorkflowDefinition(BaseModel):
    """A complete workflow the owner has approved, ready to assign to workers."""

    name: str  # "마감조 작업"
    description: str  # one-sentence summary
    estimated_duration_minutes: int
    steps: list[Step]

    # Optional: industry profile this was inferred under, useful for analytics
    # and for picking the right template prompts when refining later.
    industry_hint: str | None = None


class WorkflowInferenceInput(BaseModel):
    """
    Raw evidence the owner provides. Upstream layers (Whisper for audio,
    Claude Vision for photos) turn raw media into the string fields below.
    """

    # The owner's plain-text description, if they typed one. Optional.
    text_description: str | None = None

    # One transcript per voice recording the owner uploaded.
    # Often a single recording of the owner walking through their shop.
    voice_transcripts: list[str] = Field(default_factory=list)

    # One description per photo. Each string describes what's visible in the
    # photo (generated upstream by Claude Vision).
    photo_descriptions: list[str] = Field(default_factory=list)

    # Optional industry hint — used to load industry-specific terminology and
    # examples from products/<product>/industries/<industry>/. If None, the
    # inference does its best without a profile.
    industry_hint: str | None = None

    # If the owner is refining an existing workflow, pass the current version.
    # The inference will produce a revised one rather than starting fresh.
    existing_workflow: WorkflowDefinition | None = None


class WorkflowInferenceResult(BaseModel):
    """What `infer_workflow()` returns."""

    workflow: WorkflowDefinition

    # Things the AI was unsure about. Surface these to the owner so they can
    # answer ("바닥 청소 후에 매출 정산이 먼저인가, 재고 카운트가 먼저인가?")
    # before the workflow goes live.
    clarifying_questions: list[str] = Field(default_factory=list)
