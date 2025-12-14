# 🧠 AI Ecosystem Simulator
## Emergent Cooperation in Multi-Agent Reinforcement Learning

A real-time multi-agent reinforcement learning system where **100 autonomous AI agents** learn survival strategies and **discover cooperation organically**—without any hard-coded social rules.

This project demonstrates how complex social behaviors such as **cooperation, alliance formation, trust, and reciprocity** can emerge purely from **self-interested reward optimization**, mirroring patterns observed in human societies.

---

## 🚀 Project Overview

The AI Ecosystem Simulator places 100 agents in a shared survival environment where they must collect resources, manage health, and interact with other agents. Each agent starts with a personality-based exploration bias, but **all long-term behavior is learned**, not programmed.

Over 50 episodes, the system evolves from complete chaos into an organized society where **cooperation consistently outperforms competition**.

---

## ✨ Key Features

- 100 autonomous agents in a shared environment  
- Emergent cooperation learned through reinforcement learning  
- Multi-agent PPO (Proximal Policy Optimization)  
- Personality-biased exploration (Cooperative, Aggressive, Neutral)  
- Real-time visualization at 60 FPS  
- Live deployment with interactive dashboard  
- Quantifiable emergence of alliances and teamwork  

---

## 🎭 Agent Personalities

Agents are initialized with personality-based exploration biases:

| Personality | Percentage | Bias |
|------------|-----------|------|
| Cooperative | 40% | Sharing resources, alliance formation |
| Aggressive | 30% | Stealing for short-term gain |
| Neutral | 30% | Independent survival |

> ⚠️ Personalities influence exploration only.  
> **No cooperation logic is explicitly programmed.**

---

## 🌍 Environment

- Grid size: **20 × 20**
- Dynamic food spawning
- Health-based survival mechanics
- Episodes: **50**
- Steps per episode: **500**

---

## 🎮 Action Space (9 Actions)

Agents can perform both physical and social actions:

1. Move (up / down / left / right)
2. Collect food
3. Share food
4. Steal food
5. Form alliance
6. Maintain alliance
7. Leave alliance
8. Send communication signal
9. Idle / observe

---

## 👁️ Observation Space

Each agent receives a **40-dimensional observation vector**, including:

- Local spatial information  
- Health and resource status  
- Nearby agents’:
  - Health
  - Personality
  - Alliance status
  - Communication signals  

This enables socially-aware decision making.

---

## 🧠 Learning Algorithm

- **Algorithm:** Proximal Policy Optimization (PPO)  
- **Frameworks:** Oumi + PyTorch  
- **Neural Network:** ~85,000 parameters  
- Exploration starts near-random (personality-biased) and converges over time  

---

## 🎯 Reward Design

| Action | Reward | Long-Term Effect |
|------|--------|----------------|
| Steal | +10 | Creates enemies, isolation |
| Share | +5 | Builds alliances |
| Alliance benefit | +0.1 health / step | Sustained survival advantage |

**Result:** Agents independently discover that cooperation yields higher cumulative rewards.

---

## 📈 Emergent Results

| Metric | Episode 1 | Episode 50 |
|------|----------|-----------|
| Cooperation events | 15 | 80 |
| Theft events | 35 | 10 |
| Survival rate | 23% | 68% |
| Stable alliances | 0 | 10–15 |

Additional observations:
- Cooperative agents form defensive clusters  
- Aggressive agents patrol borders  
- Neutral agents remain independent  

---

## 🖥️ Real-Time Visualization

- **Frontend:** React  
- **Streaming:** Socket.io  
- **Rendering:** Canvas (60 FPS)  
- Displays:
  - Color-coded agents
  - Health bars
  - Alliance rings
  - Communication signals

---

## 🏗️ System Architecture

Python (Oumi + PyTorch)
↓
Multi-Agent PPO Training
↓
Node.js + Socket.io (Real-Time Streaming)
↓
React Dashboard
↓
Vercel Deployment

yaml

- Fully documented codebase  
- Reviewed using CodeRabbit  

---

## 🧪 Research Challenges Addressed

- Non-stationary multi-agent environments  
- Credit assignment problem  
- Scalability to 100 agents  
- 900-dimensional joint action space  

---

## 🌍 Applications

- Multi-robot coordination  
- Autonomous vehicle cooperation  
- Market and economic simulations  
- Ecosystem modeling  
- Adaptive NPCs in games  
- AI safety and social norm research  

---

## 🧠 Key Insight

> **Cooperation was never programmed.  
> Cooperation was learned.**

This project demonstrates that cooperation is not merely ethical—it is **mathematically optimal** under appropriate incentive structures.

---

## 🌐 Live Demo & Repository

- **Live Demo:** https://your-vercel-link  
- **GitHub Repo:** https://github.com/Marwa-001/ai-ecosystem-simulator  

---

## 📜 License

MIT License

---

## 🙌 Acknowledgements

- Oumi Reinforcement Learning Framework  
- PyTorch  
- Open-source research in multi-agent systems