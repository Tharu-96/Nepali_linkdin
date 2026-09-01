import os
import json
import PyPDF2
from groq import Groq
from pydantic import BaseModel

class ResumeData(BaseModel):
    headline: str = ""
    skills: str = ""
    experience: str = "[]"
    education: str = "[]"
    certifications: str = "[]"
    projects: str = "[]"

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        print(f"PDF extraction error: {e}")
    return text

def parse_resume(file_path: str) -> dict:
    text = ""
    if file_path.endswith(".pdf"):
        text = extract_text_from_pdf(file_path)
    # Could add docx parsing here
    
    if not text.strip():
        return ResumeData().dict()

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("No optional parsing key found, falling back to basic extraction.")
        
        return ResumeData(
            headline="Extracted from Resume",
            skills="Communication, Teamwork",
            experience=json.dumps([{"company": "Unknown", "role": "Professional", "duration": "N/A", "description": text[:200]}])
        ).dict()
    
    try:
        client = Groq(api_key=api_key)
        prompt = f"""
        Extract the following information from the resume text provided below and format it strictly as a JSON object with these keys:
        - "headline": (string, short summary or job title)
        - "skills": (string, comma-separated list of skills)
        - "experience": (JSON string representing a list of dicts with 'company', 'role', 'duration', 'description')
        - "education": (JSON string representing a list of dicts with 'institution', 'degree', 'field_of_study', 'year')
        - "certifications": (JSON string representing a list of strings)
        - "projects": (JSON string representing a list of strings or dicts)

        Resume Text:
        {text[:4000]}  # Limiting length for safety
        
        Output strictly ONLY the JSON object. No markdown blocks, no other text.
        """
        
        response = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama3-8b-8192",
            temperature=0.1,
            max_tokens=1000
        )
        content = response.choices[0].message.content.strip()
        
        # Remove markdown if present
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
            
        data = json.loads(content)
        
        # Ensure experience and education are strings if parsed as lists
        for key in ['experience', 'education', 'certifications', 'projects']:
            if key in data and isinstance(data[key], list):
                data[key] = json.dumps(data[key])
                
        return data
        
    except Exception as e:
        print(f"Structured resume parsing error: {e}")
        return ResumeData().dict()


