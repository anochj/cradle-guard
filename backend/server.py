from fastapi import FastAPI
import google.generativeai as genai
from dotenv import load_dotenv 

load_dotenv()

app = FASTAPI()

genai.configure(api_key=os.getenv("GENAI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')