# 🧠 Memorandum

🎥 **Demo Video**: [Watch on YouTube](https://www.youtube.com/watch?v=2MtTPmijZlo)

![User Interface Preview](assets/user_interface.png)

---

## ✨ Summary 
**Memorandum** is a fullstack web application that helps users **recall past conversations** with individuals currently in their **field of vision**.

The app supports two major flows:
- **1) Information Storage**
- **2) Memory Retrieval**

---

## 🗂️ Storage Flow
1. 📸 The person in the user’s field of vision is **identified** and **recognized** using **face embedding similarity scores**.
2. 🎙️ A **real-time conversation** with the identified person is **recorded** and **transcribed**.
3. 🧠 The conversation is **processed** via an **LLM** and **stored** in a **Pinecone Vector Database**.

---

## 🔍 Retrieval Flow
1. 📚 A **query** is called to **Pinecone** to retrieve **past conversation texts**, assisting in **memory recall**.
2. 🧾 A **secondary query** retrieves **immediate facts** (e.g., name, age) about the recognized person from **Supabase**.

---
