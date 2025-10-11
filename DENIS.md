# Denis — Development Plan (Gemini Edition)

## Goal
Deliver a working end-to-end prototype (video → scenes → descriptions → Weave logs → prompt optimization) using **Google Gemini**.

---

## Saturday
**12–1 pm**
- Init Node repo and basic Express server  
- Install dependencies (`weave`, `@google/generative-ai`, `ffmpeg-static`)  
- Test Weave init and log sample data  

**1–6 pm**
- Implement video → frames via ffmpeg  
- Call **Google Gemini Vision** API for captions  
- Output JSON (`scene`, `caption`)  
- Log to Weave with promptVersion metadata  
- Commit working prototype  

**7–9 pm**
- Add 2–3 prompt templates + selector function  
- Compute score (via embedding similarity or human rating)  
- Log results per prompt to Weave  
- Visualize scores / trend  

---

## Sunday
**9–11 am**
- (Optional) Tiny React/Svelte UI for upload and view results  
- Integrate **Tavily** (search captions) or **BrowserBase** (scrape YouTube desc)  

**11–12 pm**
- Final polish, README update, record demo video  

**12–1:30 pm**
- Prepare live demo, assist Valerii with technical slides  

---

## Notes
- Keep code lightweight and modular  
- Prioritize Weave integration first (eligibility)  
- Save prompts/results under `/output/` for demo  
- Focus on the Gemini API — use `gemini-1.5-pro` or similar multimodal model
