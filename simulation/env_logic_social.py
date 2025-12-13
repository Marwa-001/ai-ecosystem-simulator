"""
Enhanced AI Ecosystem with Social Interactions - FIXED DIMENSIONS
- Agent personalities (Cooperative, Aggressive, Neutral)
- Alliances and teamwork
- Resource sharing and theft
- Communication between agents
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces
from typing import Dict, Tuple, List, Set
from dataclasses import dataclass
from enum import Enum

class Personality(Enum):
    COOPERATIVE = 0  # Shares food, forms alliances
    AGGRESSIVE = 1   # Steals food, attacks others
    NEUTRAL = 2      # Solo player, balanced

@dataclass
class Agent:
    """Enhanced agent with social capabilities"""
    id: int
    position: np.ndarray
    personality: Personality
    health: int = 100
    score: int = 0
    alliance_id: int = -1  # -1 means no alliance
    food_inventory: int = 0
    communication_signal: int = 0  # 0=none, 1=help, 2=food, 3=danger
    
class EcosystemEnvSocial(gym.Env):
    """
    Enhanced multi-agent environment with social interactions
    
    Observation space breakdown (40 dims total):
    - Position (2): x, y
    - Health (1): normalized health
    - Food inventory (1): amount of food held
    - Nearest food (2): relative x, y
    - Personality encoding (3): one-hot [coop, agg, neutral]
    - Alliance status (1): has alliance or not
    - Nearby agents count (1)
    - Nearby cooperative count (1)
    - Nearby aggressive count (1)
    - Communication signals (3): help, food, danger
    - Local obstacle map (5x5 = 25): surrounding terrain
    TOTAL: 2+1+1+2+3+1+1+1+1+3+25 = 41 → Need to reduce to 40
    
    FIX: Remove one dimension from local map or merge some features
    """
    
    metadata = {'render_modes': ['human']}
    
    def __init__(self, grid_size=20, num_agents=100, num_food=30, num_obstacles=50):
        super().__init__()
        
        self.grid_size = grid_size
        self.num_agents = num_agents
        self.num_food = num_food
        self.num_obstacles = num_obstacles
        
        # Extended action space: movement + social actions
        # 0-4: movement, 5: share food, 6: steal, 7: form alliance, 8: signal help
        self.action_space = spaces.Discrete(9)
        
        # FIXED: Observation space = 40 dimensions exactly
        self.observation_space = spaces.Box(
            low=-grid_size, 
            high=grid_size, 
            shape=(40,),  # Exactly 40!
            dtype=np.float32
        )
        
        # Initialize agents with personalities
        self.agents: List[Agent] = []
        self.food_pos = []
        self.obstacles = set()
        
        # Social structures
        self.alliances: Dict[int, Set[int]] = {}  # alliance_id -> set of agent_ids
        self.next_alliance_id = 0
        
        # Stats tracking
        self.total_steps = 0
        self.cooperation_events = 0
        self.theft_events = 0
        self.alliance_formations = 0
        
    def reset(self, seed=None, options=None):
        """Reset environment with personality distribution"""
        super().reset(seed=seed)
        
        # Create agents with personality distribution
        self.agents = []
        personality_dist = [
            Personality.COOPERATIVE,
            Personality.AGGRESSIVE, 
            Personality.NEUTRAL
        ]
        
        for i in range(self.num_agents):
            # Weighted distribution: 40% coop, 30% aggressive, 30% neutral
            weights = [0.4, 0.3, 0.3]
            personality = np.random.choice(personality_dist, p=weights)
            
            pos = np.array([
                np.random.randint(0, self.grid_size),
                np.random.randint(0, self.grid_size)
            ])
            
            agent = Agent(
                id=i,
                position=pos,
                personality=personality,
                health=100,
                score=0,
                alliance_id=-1,
                food_inventory=0,
                communication_signal=0
            )
            self.agents.append(agent)
        
        # Random food positions
        self.food_pos = []
        for _ in range(self.num_food):
            pos = (
                np.random.randint(0, self.grid_size),
                np.random.randint(0, self.grid_size)
            )
            self.food_pos.append(pos)
        
        # Random obstacles
        self.obstacles = set()
        for _ in range(self.num_obstacles):
            pos = (
                np.random.randint(0, self.grid_size),
                np.random.randint(0, self.grid_size)
            )
            self.obstacles.add(pos)
        
        # Reset social structures
        self.alliances = {}
        self.next_alliance_id = 0
        self.total_steps = 0
        self.cooperation_events = 0
        self.theft_events = 0
        self.alliance_formations = 0
        
        return self._get_observations(), {}
    
    def _get_observations(self) -> List[np.ndarray]:
        """
        Generate observations with EXACTLY 40 dimensions
        
        Breakdown:
        - Position (2): x, y
        - Health (1): normalized
        - Food inventory (1)
        - Nearest food (2): rel_x, rel_y
        - Personality (3): one-hot
        - Alliance (1): has or not
        - Nearby agents (3): total, coop, agg
        - Signals (3): help, food, danger
        - Local obstacles (3x3 = 9): reduced from 5x5
        - Padding (15): to reach exactly 40
        
        NEW TOTAL: 2+1+1+2+3+1+3+3+9+15 = 40 ✓
        """
        observations = []
        
        for agent in self.agents:
            obs = []
            
            # 1-2: Position (2 dims)
            obs.extend([
                float(agent.position[0]),
                float(agent.position[1])
            ])
            
            # 3: Health (1 dim)
            obs.append(agent.health / 100.0)
            
            # 4: Food inventory (1 dim)
            obs.append(float(agent.food_inventory))
            
            # 5-6: Nearest food (2 dims)
            if self.food_pos:
                distances = [np.linalg.norm(agent.position - np.array(food)) 
                           for food in self.food_pos]
                nearest_food = self.food_pos[np.argmin(distances)]
                obs.extend([
                    float(nearest_food[0] - agent.position[0]),
                    float(nearest_food[1] - agent.position[1])
                ])
            else:
                obs.extend([0.0, 0.0])
            
            # 7-9: Personality one-hot (3 dims)
            obs.extend([
                1.0 if agent.personality == Personality.COOPERATIVE else 0.0,
                1.0 if agent.personality == Personality.AGGRESSIVE else 0.0,
                1.0 if agent.personality == Personality.NEUTRAL else 0.0
            ])
            
            # 10: Alliance status (1 dim)
            obs.append(1.0 if agent.alliance_id >= 0 else 0.0)
            
            # 11-13: Nearby agents (3 dims)
            nearby_agents = self._get_nearby_agents(agent, radius=3)
            nearby_coop = sum(1 for a in nearby_agents 
                            if self.agents[a].personality == Personality.COOPERATIVE)
            nearby_agg = sum(1 for a in nearby_agents 
                           if self.agents[a].personality == Personality.AGGRESSIVE)
            
            obs.extend([
                float(len(nearby_agents)),
                float(nearby_coop),
                float(nearby_agg)
            ])
            
            # 14-16: Communication signals (3 dims)
            signals = [self.agents[a].communication_signal for a in nearby_agents]
            obs.extend([
                1.0 if 1 in signals else 0.0,  # Help signal
                1.0 if 2 in signals else 0.0,  # Food signal
                1.0 if 3 in signals else 0.0   # Danger signal
            ])
            
            # 17-25: Local obstacle map 3x3 (9 dims) - REDUCED from 5x5
            local_obs = []
            for dx in range(-1, 2):  # Changed from -2,3 to -1,2
                for dy in range(-1, 2):
                    check_pos = (agent.position[0] + dx, agent.position[1] + dy)
                    if check_pos in self.obstacles:
                        local_obs.append(1.0)
                    else:
                        local_obs.append(0.0)
            obs.extend(local_obs)  # 9 dims
            
            # 26-40: Padding to reach exactly 40 (15 dims)
            obs.extend([0.0] * 15)
            
            # Verify dimension
            assert len(obs) == 40, f"Observation has {len(obs)} dims, expected 40"
            
            observations.append(np.array(obs, dtype=np.float32))
        
        return observations
    
    def _get_nearby_agents(self, agent: Agent, radius: int = 3) -> List[int]:
        """Get IDs of agents within radius"""
        nearby = []
        for other in self.agents:
            if other.id != agent.id:
                dist = np.linalg.norm(agent.position - other.position)
                if dist <= radius:
                    nearby.append(other.id)
        return nearby
    
    def step(self, actions: List[int]) -> Tuple:
        """Execute actions with social interactions"""
        rewards = np.zeros(self.num_agents)
        
        # Action mapping
        action_map = {
            0: (0, 0),   # Stay
            1: (0, -1),  # Up
            2: (0, 1),   # Down
            3: (-1, 0),  # Left
            4: (1, 0)    # Right
        }
        
        # Phase 1: Movement
        for i, action in enumerate(actions):
            agent = self.agents[i]
            
            # Reset communication signal
            agent.communication_signal = 0
            
            # Handle movement actions (0-4)
            if action <= 4:
                dx, dy = action_map[action]
                new_pos = np.array([
                    np.clip(agent.position[0] + dx, 0, self.grid_size - 1),
                    np.clip(agent.position[1] + dy, 0, self.grid_size - 1)
                ])
                
                # Check collision
                if tuple(new_pos) in self.obstacles:
                    rewards[i] = -5
                    agent.health = max(0, agent.health - 2)
                else:
                    agent.position = new_pos
                    rewards[i] = -1  # Step penalty
                    
                    # Check food collection
                    if tuple(new_pos) in self.food_pos:
                        agent.food_inventory += 1
                        agent.score += 1
                        agent.health = min(100, agent.health + 10)
                        rewards[i] = 15  # Higher reward
                        
                        self.food_pos.remove(tuple(new_pos))
                        
                        # Respawn food
                        new_food = (
                            np.random.randint(0, self.grid_size),
                            np.random.randint(0, self.grid_size)
                        )
                        self.food_pos.append(new_food)
        
        # Phase 2: Social interactions
        for i, action in enumerate(actions):
            agent = self.agents[i]
            nearby = self._get_nearby_agents(agent, radius=2)
            
            # Action 5: Share food (Cooperative)
            if action == 5 and agent.food_inventory > 0:
                if agent.personality == Personality.COOPERATIVE:
                    for other_id in nearby:
                        other = self.agents[other_id]
                        if other.personality == Personality.COOPERATIVE:
                            agent.food_inventory -= 1
                            other.food_inventory += 1
                            other.score += 1
                            rewards[i] += 5
                            rewards[other_id] += 5
                            self.cooperation_events += 1
                            break
            
            # Action 6: Steal food (Aggressive)
            elif action == 6:
                if agent.personality == Personality.AGGRESSIVE:
                    for other_id in nearby:
                        other = self.agents[other_id]
                        if other.food_inventory > 0:
                            stolen = min(1, other.food_inventory)
                            other.food_inventory -= stolen
                            agent.food_inventory += stolen
                            agent.score += stolen
                            rewards[i] += 10
                            rewards[other_id] -= 10
                            self.theft_events += 1
                            break
            
            # Action 7: Form alliance
            elif action == 7:
                if agent.personality == Personality.COOPERATIVE and agent.alliance_id < 0:
                    for other_id in nearby:
                        other = self.agents[other_id]
                        if other.personality == Personality.COOPERATIVE:
                            if other.alliance_id >= 0:
                                agent.alliance_id = other.alliance_id
                                self.alliances[other.alliance_id].add(agent.id)
                            else:
                                new_id = self.next_alliance_id
                                self.next_alliance_id += 1
                                self.alliances[new_id] = {agent.id, other.id}
                                agent.alliance_id = new_id
                                other.alliance_id = new_id
                                self.alliance_formations += 1
                            
                            rewards[i] += 3
                            rewards[other_id] += 3
                            break
            
            # Action 8: Signal for help
            elif action == 8:
                agent.communication_signal = 1
                if agent.alliance_id >= 0:
                    for other_id in self.alliances[agent.alliance_id]:
                        if other_id in nearby:
                            rewards[i] += 2
                            rewards[other_id] += 2
        
        # Alliance bonuses
        for alliance_members in self.alliances.values():
            if len(alliance_members) > 1:
                for member_id in alliance_members:
                    self.agents[member_id].health = min(
                        100, 
                        self.agents[member_id].health + 0.1
                    )
        
        # Health decay
        for agent in self.agents:
            agent.health = max(0, agent.health - 0.2)
        
        self.total_steps += 1
        terminated = self.total_steps >= 500
        truncated = False
        
        info = {
            'survival_rate': np.mean([a.score > 0 for a in self.agents]),
            'avg_score': np.mean([a.score for a in self.agents]),
            'total_food_collected': sum(a.score for a in self.agents),
            'cooperation_events': self.cooperation_events,
            'theft_events': self.theft_events,
            'num_alliances': len(self.alliances),
            'avg_health': np.mean([a.health for a in self.agents]),
            'personality_scores': {
                'cooperative': np.mean([a.score for a in self.agents 
                                       if a.personality == Personality.COOPERATIVE]),
                'aggressive': np.mean([a.score for a in self.agents 
                                      if a.personality == Personality.AGGRESSIVE]),
                'neutral': np.mean([a.score for a in self.agents 
                                   if a.personality == Personality.NEUTRAL])
            }
        }
        
        return self._get_observations(), rewards.tolist(), terminated, truncated, info
    
    def get_state_for_render(self) -> Dict:
        """Get current state with social information for visualization"""
        return {
            'agents': [agent.position.tolist() for agent in self.agents],
            'food': self.food_pos,
            'obstacles': list(self.obstacles),
            'scores': [agent.score for agent in self.agents],
            'health': [agent.health for agent in self.agents],
            'personalities': [agent.personality.value for agent in self.agents],
            'alliances': [agent.alliance_id for agent in self.agents],
            'food_inventory': [agent.food_inventory for agent in self.agents],
            'communication': [agent.communication_signal for agent in self.agents],
            'steps': self.total_steps,
            'survival_rate': np.mean([a.score > 0 for a in self.agents]),
            'cooperation_events': self.cooperation_events,
            'theft_events': self.theft_events,
            'num_alliances': len(self.alliances),
            'avg_health': np.mean([a.health for a in self.agents])
        }