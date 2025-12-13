"""
Enhanced Multi-Agent RL with Social Interactions
- Cooperation, aggression, alliances
- Communication between agents
- Personality-based behavior
"""

import json
import time
import numpy as np
import socketio
from env_logic_social import EcosystemEnvSocial, Personality
from datetime import datetime

# Socket.io client
sio = socketio.Client(logger=True, engineio_logger=True)

# Check for PyTorch and Oumi
TORCH_AVAILABLE = False
try:
    import torch
    TORCH_AVAILABLE = True
    print("✅ PyTorch available for social RL")
except ImportError:
    print("⚠️  PyTorch not available, using simple agent")


class SocialRLAgent:
    """
    RL Agent with social action learning
    """
    
    def __init__(self, num_agents, obs_dim=40, action_space=9):
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch required")
        
        self.num_agents = num_agents
        self.obs_dim = obs_dim
        self.action_space = action_space
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        print(f"\n🤖 Initializing Social RL Agent...")
        print(f"   Observation dim: {obs_dim} (includes social info)")
        print(f"   Action space: {action_space} (movement + social)")
        
        # Create policy network
        self.policy = self._create_policy_network()
        self.optimizer = torch.optim.Adam(self.policy.parameters(), lr=3e-4)
        
        self.exploration_rate = 1.0
        self.exploration_decay = 0.995
        self.exploration_min = 0.1
        
        self.clear_buffer()
        
        param_count = sum(p.numel() for p in self.policy.parameters())
        print(f"   Policy network: {param_count:,} parameters")
        print(f"✅ Social RL Agent initialized!\n")
    
    def _create_policy_network(self):
        """Larger network for social reasoning"""
        return torch.nn.Sequential(
            torch.nn.Linear(self.obs_dim, 256),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(256, 256),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(256, 128),
            torch.nn.ReLU(),
            torch.nn.Linear(128, self.action_space)
        ).to(self.device)
    
    def clear_buffer(self):
        self.states = []
        self.actions = []
        self.rewards = []
    
    def select_actions(self, observations, personalities):
        """Select actions considering agent personalities"""
        obs_array = np.array(observations, dtype=np.float32)
        obs_tensor = torch.FloatTensor(obs_array).to(self.device)
        
        actions = []
        
        with torch.no_grad():
            logits = self.policy(obs_tensor)
            
            for i in range(self.num_agents):
                if np.random.rand() < self.exploration_rate:
                    # Exploration: bias towards personality
                    if personalities[i] == Personality.COOPERATIVE:
                        # Cooperative agents prefer social actions
                        action = np.random.choice([0, 1, 2, 3, 4, 5, 7, 8], 
                                                 p=[0.2, 0.15, 0.15, 0.15, 0.15, 0.1, 0.05, 0.05])
                    elif personalities[i] == Personality.AGGRESSIVE:
                        # Aggressive agents prefer movement and stealing
                        action = np.random.choice([0, 1, 2, 3, 4, 6], 
                                                 p=[0.1, 0.2, 0.2, 0.2, 0.2, 0.1])
                    else:  # Neutral
                        # Neutral agents focus on movement
                        action = np.random.choice([0, 1, 2, 3, 4], 
                                                 p=[0.2, 0.2, 0.2, 0.2, 0.2])
                else:
                    # Exploitation: use policy
                    probs = torch.softmax(logits[i], dim=0)
                    dist = torch.distributions.Categorical(probs)
                    action = dist.sample().item()
                
                actions.append(action)
        
        return actions
    
    def store_transition(self, states, actions, rewards):
        self.states.extend(states)
        self.actions.extend(actions)
        self.rewards.extend(rewards)
    
    def update_policy(self):
        if len(self.states) < 64:
            return 0.0
        
        states = torch.FloatTensor(self.states).to(self.device)
        actions = torch.LongTensor(self.actions).to(self.device)
        rewards = torch.FloatTensor(self.rewards).to(self.device)
        
        rewards = (rewards - rewards.mean()) / (rewards.std() + 1e-8)
        
        logits = self.policy(states)
        probs = torch.softmax(logits, dim=1)
        dist = torch.distributions.Categorical(probs)
        
        log_probs = dist.log_prob(actions)
        entropy = dist.entropy().mean()
        
        policy_loss = -(log_probs * rewards).mean()
        loss = policy_loss - 0.01 * entropy
        
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy.parameters(), 0.5)
        self.optimizer.step()
        
        total_loss = loss.item()
        self.clear_buffer()
        
        self.exploration_rate = max(
            self.exploration_min,
            self.exploration_rate * self.exploration_decay
        )
        
        return total_loss


def save_survival_data(episode_stats):
    """Save enhanced episode statistics"""
    data_path = '../data/survival_data_social.json'
    
    try:
        with open(data_path, 'r') as f:
            history = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        history = {'episodes': []}
    
    history['episodes'].append(episode_stats)
    
    if len(history['episodes']) > 100:
        history['episodes'] = history['episodes'][-100:]
    
    with open(data_path, 'w') as f:
        json.dump(history, f, indent=2)


@sio.event
def connect():
    print('✅ CONNECTED to server')

@sio.event
def disconnect():
    print('❌ Disconnected from server')

@sio.event
def connection_confirmed(data):
    print(f'🎉 Server confirmed: {data}')


def main():
    print('=' * 70)
    print('🌟 ENHANCED AI ECOSYSTEM WITH SOCIAL INTERACTIONS')
    print('=' * 70)
    print()
    print('New Features:')
    print('  🤝 Cooperative agents (share food, form alliances)')
    print('  ⚔️  Aggressive agents (steal food, lone wolves)')
    print('  ⚖️  Neutral agents (balanced, solo players)')
    print('  📡 Communication signals between agents')
    print('  🛡️  Alliance system for teamwork')
    print('=' * 70)
    
    # Connect to server
    try:
        print('\n📡 Connecting to server...')
        sio.connect(
            'http://localhost:4000',
            auth={'type': 'python'},
            wait_timeout=10
        )
        time.sleep(2)
        if sio.connected:
            print('✅ Connected!')
    except Exception as e:
        print(f'⚠️  Server connection failed: {e}')
    
    # Initialize environment
    print('\n🎮 Initializing enhanced environment...')
    env = EcosystemEnvSocial(
        grid_size=20, 
        num_agents=100, 
        num_food=30, 
        num_obstacles=50
    )
    
    # Initialize agent
    if TORCH_AVAILABLE:
        agent = SocialRLAgent(num_agents=100, obs_dim=40, action_space=9)
        agent_type = 'Social RL (Oumi)'
    else:
        print('❌ PyTorch required for social RL!')
        return
    
    num_episodes = 50
    steps_per_episode = 500
    update_frequency = 20
    
    print(f'\n🎯 Training Configuration:')
    print(f'   Agent Type: {agent_type}')
    print(f'   Episodes: {num_episodes}')
    print(f'   Action Space: 9 (5 movement + 4 social)')
    print()
    
    for episode in range(num_episodes):
        observations, _ = env.reset()
        personalities = [a.personality for a in env.agents]
        
        episode_reward = 0
        step_count = 0
        total_loss = 0
        num_updates = 0
        
        print(f'\n{"=" * 70}')
        print(f'📊 EPISODE {episode + 1}/{num_episodes}')
        print(f'{"=" * 70}')
        
        # Count personalities
        coop = sum(1 for p in personalities if p == Personality.COOPERATIVE)
        agg = sum(1 for p in personalities if p == Personality.AGGRESSIVE)
        neu = sum(1 for p in personalities if p == Personality.NEUTRAL)
        print(f'Personalities: 🤝 {coop} Cooperative | ⚔️ {agg} Aggressive | ⚖️ {neu} Neutral')
        
        if sio.connected:
            try:
                sio.emit('episode_start', {
                    'episode': episode + 1,
                    'personalities': {
                        'cooperative': coop,
                        'aggressive': agg,
                        'neutral': neu
                    }
                })
            except:
                pass
        
        while step_count < steps_per_episode:
            # Select actions
            actions = agent.select_actions(observations, personalities)
            
            # Execute step
            next_observations, rewards, terminated, truncated, info = env.step(actions)
            
            # Store transition
            agent.store_transition(observations, actions, rewards)
            
            # Update policy
            if step_count % update_frequency == 0 and step_count > 0:
                loss = agent.update_policy()
                total_loss += loss
                num_updates += 1
                
                if step_count % 100 == 0:
                    avg_loss = total_loss / max(num_updates, 1)
                    print(f'  🔄 Step {step_count:3d} | Loss: {avg_loss:.4f} | '
                          f'Survival: {info["survival_rate"]:.1%} | '
                          f'Alliances: {info["num_alliances"]} | '
                          f'Cooperations: {info["cooperation_events"]} | '
                          f'Thefts: {info["theft_events"]}')
            
            observations = next_observations
            episode_reward += sum(rewards)
            step_count += 1
            
            # Stream to frontend
            if step_count % 10 == 0 and sio.connected:
                state = env.get_state_for_render()
                state.update({
                    'episode': episode + 1,
                    'step': step_count,
                    'max_steps': steps_per_episode,
                    'progress': (step_count / steps_per_episode) * 100,
                    'total_reward': float(episode_reward),
                    'agent_type': agent_type,
                    'epsilon': float(agent.exploration_rate)
                })
                
                try:
                    sio.emit('simulation_update', state)
                except Exception as e:
                    if step_count % 100 == 0:
                        print(f'  ⚠️  Emission error: {e}')
            
            time.sleep(0.03)
        
        # Episode complete
        print(f'\n{"─" * 70}')
        print(f'✅ EPISODE {episode + 1} COMPLETE')
        print(f'{"─" * 70}')
        
        episode_stats = {
            'episode': episode + 1,
            'total_reward': float(episode_reward),
            'survival_rate': float(info['survival_rate']),
            'avg_score': float(info['avg_score']),
            'total_food_collected': float(info['total_food_collected']),
            'cooperation_events': int(info['cooperation_events']),
            'theft_events': int(info['theft_events']),
            'num_alliances': int(info['num_alliances']),
            'avg_health': float(info['avg_health']),
            'personality_scores': {
                k: float(v) for k, v in info['personality_scores'].items()
            },
            'agent_type': agent_type,
            'timestamp': datetime.now().isoformat()
        }
        
        print(f'  💯 Survival Rate: {info["survival_rate"]:.2%}')
        print(f'  🍎 Food Collected: {info["total_food_collected"]:.0f}')
        print(f'  🤝 Cooperations: {info["cooperation_events"]}')
        print(f'  ⚔️  Thefts: {info["theft_events"]}')
        print(f'  🛡️  Alliances: {info["num_alliances"]}')
        print(f'  ❤️  Avg Health: {info["avg_health"]:.1f}')
        print(f'\n  Personality Performance:')
        print(f'    🤝 Cooperative: {info["personality_scores"]["cooperative"]:.2f}')
        print(f'    ⚔️  Aggressive: {info["personality_scores"]["aggressive"]:.2f}')
        print(f'    ⚖️  Neutral: {info["personality_scores"]["neutral"]:.2f}')
        
        save_survival_data(episode_stats)
        
        if sio.connected:
            try:
                sio.emit('episode_complete', episode_stats)
            except:
                pass
        
        time.sleep(3)
    
    print('\n' + '=' * 70)
    print('🎉 TRAINING COMPLETE!')
    print('=' * 70)
    
    if sio.connected:
        sio.disconnect()


if __name__ == '__main__':
    main()