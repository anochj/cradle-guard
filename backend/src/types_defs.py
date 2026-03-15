from pydantic import BaseModel, Field

class ObjectRelationship(BaseModel):
    object_a: str = Field(..., description="The first object in the relationship")
    object_b: str = Field(..., description="The second object in the relationship")
    unsafe_distance: int = Field(..., description="Distance where the two objects are within a distance of each other, where they would break a relationship. ie. 'child can't touch dog', dog and child would be unsafe at 50. From 20-100.")

class SituationAnalysisResult(BaseModel):
    analysis: str = Field(..., description="Textual analysis of the current situation based on detected objects and context")
    immediately_alert: bool = Field(..., description="Whether the user should be immediately alerted to danger")
    relationships: list[ObjectRelationship] = Field(..., description="List of detected relationships between objects that may indicate potential dangers")

class SpecialInstructionRequest(BaseModel):
    instruction: str = Field(..., description="The special instruction to save")

class RelationMapRequest(BaseModel):
    text: str = Field(..., description="Text description used to generate a relation map of object safety rules")

class RelationMapResult(BaseModel):
    relationships: list[ObjectRelationship] = Field(..., description="List of object relationships inferred from the provided text")
