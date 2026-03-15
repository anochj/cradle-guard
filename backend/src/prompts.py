#f-string for custom danger?
#yolo does anaylsis and gives us a list of hazards, which is used to custom prompt Gemini to focus on those hazards, else general safety check
def get_relation_map_prompt(text: str) -> str:
    """
    Generates a prompt asking Gemini to extract object safety relationships from free-form text.
    """
    return f"""
    You are an expert nursery and home safety analyst AI.

    Based on the following user-provided description or context, generate a list of object relationship pairs that represent potential safety hazards.
    Each relationship describes two objects that could be dangerous when in proximity to each other, and an "unsafe_distance" value in pixels (range 20-100)
    indicating the threshold at which their proximity becomes concerning — higher values mean the pair is dangerous even from further away.

    Examples:
    - baby near scissors → unsafe_distance close to 100 (extreme danger)
    - baby near a soft toy → unsafe_distance close to 20 (mild concern)
    - child near an open window → unsafe_distance around 80

    User description:
    {text}

    You must respond ONLY with a valid JSON object. Do not include markdown, code fences, or extra commentary.
    """

def get_safety_prompt(yolo_hazards: list, is_deep_scan: bool = False) -> str:
    """
    Generates a dynamic prompt for Gemini based on WHY it was woken up.
    """

    # if YOLO detects any hazards, we want to immediately focus on those in the prompt
    if len(yolo_hazards) > 0:
        hazards_str = ", ".join(yolo_hazards)
        context = f"""
        URGENT TRIGGER: Our local bounding-box model (YOLO) just flagged these objects overlapping with the baby: {hazards_str}. 
        Focus immediately on the interaction between the baby and these objects. Check if the airway is blocked or if physical harm is occurring.
        """
    #If it's a deep scan, emphasize the need for comprehensive analysis, else, it's a general safety check.
    elif is_deep_scan:
        context = """
        DEEP SCAN TRIGGER: This is a routine 60-second deep scan. Our local YOLO model only detects basic overlapping boxes and misses heavy contextual dangers (e.g., a baby crawling toward a hot stove, exposed electrical wires, open windows, or unsafe crib structures). 
        Perform a comprehensive environmental analysis of the entire room to catch anything the basic bounding-box model missed.
        """
    else:
        context = "General safety check."

    # Fomat prompt with the appropriate context based on the trigger
    prompt = f"""
    You are an expert nursery safety monitor AI. 

    {context}

    Your job is to act as the senior reasoning engine. Look closely at the image and answer:
    1. Is the baby in any immediate physical danger from objects, falls, or the environment?
    2. Are there any contextual hazards in the room that a simple object-detector would miss?

    You must respond ONLY with a valid JSON object. Do not include markdown formatting.
    Format: {{"status": "SAFE" or "HAZARD", "reason": "Detailed explanation of exactly what you see and why it is safe or dangerous."}}
    """

    return prompt