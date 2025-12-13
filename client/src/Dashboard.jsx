import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

const GRID_SIZE = 20;
const CELL_SIZE = 25;

const PERSONALITY_COLORS = {
  0: '#4caf50',
  1: '#f44336',
  2: '#2196f3'
};

const ALLIANCE_COLORS = [
  '#9c27b0', '#ff9800', '#00bcd4', '#ffeb3b', 
  '#e91e63', '#8bc34a', '#ff5722', '#03a9f4'
];

export default function DashboardSocial() {
  const [connected, setConnected] = useState(false);
  const [simulationState, setSimulationState] = useState(null);
  const [episodeHistory, setEpisodeHistory] = useState([]);
  const [currentEpisodeData, setCurrentEpisodeData] = useState([]);
  const [stats, setStats] = useState({
    episode: 0,
    survivalRate: 0,
    totalFood: 0,
    avgScore: 0,
    cooperations: 0,
    thefts: 0,
    alliances: 0,
    avgHealth: 100
  });
  
  const canvasRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';
    
    socketRef.current = io(serverUrl, {
      auth: { type: 'react' },
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server');
      setConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnected(false);
    });

    socketRef.current.on('state_update', (data) => {
      console.log('📊 State update received:', data);
      setSimulationState(data);
      
      const newStats = {
        episode: data.episode || 0,
        survivalRate: data.survival_rate || 0,
        totalFood: data.total_food_collected || 0,
        avgScore: data.avg_score || 0,
        cooperations: data.cooperation_events || 0,
        thefts: data.theft_events || 0,
        alliances: data.num_alliances || 0,
        avgHealth: data.avg_health || 100
      };
      setStats(newStats);
      
      // Add current step data for real-time graph
      setCurrentEpisodeData(prev => {
        const newData = [...prev, {
          step: data.step || 0,
          cooperations: data.cooperation_events || 0,
          thefts: data.theft_events || 0,
          alliances: data.num_alliances || 0,
          health: data.avg_health || 100
        }];
        // Keep last 50 data points
        return newData.slice(-50);
      });
    });

    socketRef.current.on('episode_complete', (data) => {
      console.log('✅ Episode complete:', data);
      
      setEpisodeHistory(prev => {
        const newEntry = {
          episode: data.episode,
          survivalRate: ((data.survival_rate || 0) * 100).toFixed(1),
          cooperations: data.cooperation_events || 0,
          thefts: data.theft_events || 0,
          alliances: data.num_alliances || 0,
          coopScore: data.personality_scores?.cooperative || 0,
          aggScore: data.personality_scores?.aggressive || 0,
          neuScore: data.personality_scores?.neutral || 0
        };
        
        const updated = [...prev, newEntry];
        console.log('Updated episode history:', updated);
        return updated.slice(-50);
      });
      
      // Clear current episode data for next episode
      setCurrentEpisodeData([]);
    });

    // Request initial history
    socketRef.current.emit('request_update');

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const renderGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simulationState) return;

    const ctx = canvas.getContext('2d');
    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Obstacles
    ctx.fillStyle = '#37474f';
    simulationState.obstacles?.forEach(([x, y]) => {
      ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });

    // Food
    ctx.fillStyle = '#4caf50';
    simulationState.food?.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(
        x * CELL_SIZE + CELL_SIZE / 2,
        y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2.5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });

    // Agents
    const agents = simulationState.agents || [];
    const personalities = simulationState.personalities || [];
    const alliances = simulationState.alliances || [];
    const health = simulationState.health || [];
    const communication = simulationState.communication || [];
    
    agents.forEach(([x, y], idx) => {
      const personality = personalities[idx];
      const alliance = alliances[idx];
      const hp = health[idx] || 100;
      const signal = communication[idx];
      
      ctx.fillStyle = PERSONALITY_COLORS[personality] || '#999';
      
      if (alliance >= 0) {
        ctx.strokeStyle = ALLIANCE_COLORS[alliance % ALLIANCE_COLORS.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          x * CELL_SIZE + CELL_SIZE / 2,
          y * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE / 2.5,
          0,
          2 * Math.PI
        );
        ctx.stroke();
      }
      
      ctx.beginPath();
      ctx.arc(
        x * CELL_SIZE + CELL_SIZE / 2,
        y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 3,
        0,
        2 * Math.PI
      );
      ctx.fill();
      
      const barWidth = CELL_SIZE - 4;
      const barHeight = 3;
      const barX = x * CELL_SIZE + 2;
      const barY = y * CELL_SIZE - 5;
      
      ctx.fillStyle = '#000';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      const healthColor = hp > 66 ? '#4caf50' : hp > 33 ? '#ff9800' : '#f44336';
      ctx.fillStyle = healthColor;
      ctx.fillRect(barX, barY, (barWidth * hp) / 100, barHeight);
      
      if (signal > 0) {
        ctx.fillStyle = signal === 1 ? '#ffeb3b' : signal === 2 ? '#4caf50' : '#f44336';
        ctx.beginPath();
        ctx.arc(
          x * CELL_SIZE + CELL_SIZE / 2,
          y * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 2,
          3,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    });

  }, [simulationState]);

  useEffect(() => {
    renderGrid();
  }, [renderGrid]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#1976d2', fontSize: '32px' }}>
          🌟 AI Ecosystem with Social Interactions
        </h1>
        <div style={{ marginTop: '10px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: '12px', 
            backgroundColor: connected ? '#4caf50' : '#f44336',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            Episode: <strong>{stats.episode}</strong>
          </span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            🤝 Cooperations: <strong>{stats.cooperations}</strong>
          </span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            ⚔️ Thefts: <strong>{stats.thefts}</strong>
          </span>
          <span style={{ color: '#666', fontSize: '14px' }}>
            🛡️ Alliances: <strong>{stats.alliances}</strong>
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Survival Rate</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
            {(stats.survivalRate * 100).toFixed(1)}%
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Avg Health</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff9800' }}>
            {stats.avgHealth.toFixed(0)}
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Cooperations</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
            {stats.cooperations}
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Thefts</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f44336' }}>
            {stats.thefts}
          </div>
        </div>
        
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#666', fontSize: '12px', marginBottom: '5px' }}>Alliances</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#9c27b0' }}>
            {stats.alliances}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Canvas Grid */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
            Live Simulation
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <canvas 
              ref={canvasRef} 
              width={GRID_SIZE * CELL_SIZE} 
              height={GRID_SIZE * CELL_SIZE}
              style={{ border: '2px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px' }}>
            <div style={{ marginBottom: '8px' }}><strong>Personalities:</strong></div>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <span><span style={{ color: '#4caf50' }}>●</span> Cooperative</span>
              <span><span style={{ color: '#f44336' }}>●</span> Aggressive</span>
              <span><span style={{ color: '#2196f3' }}>●</span> Neutral</span>
            </div>
          </div>
        </div>

        {/* Real-time Episode Graph */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
            Current Episode Progress
          </h2>
          {currentEpisodeData.length > 1 ? (
            <ResponsiveContainer width="100%" height={480}>
              <LineChart data={currentEpisodeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="step" label={{ value: 'Step', position: 'insideBottom', offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cooperations" stroke="#4caf50" strokeWidth={2} name="Cooperations" />
                <Line type="monotone" dataKey="thefts" stroke="#f44336" strokeWidth={2} name="Thefts" />
                <Line type="monotone" dataKey="alliances" stroke="#9c27b0" strokeWidth={2} name="Alliances" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
                <div>Waiting for data...</div>
                <div style={{ fontSize: '12px', marginTop: '5px' }}>
                  Episode: {stats.episode} | Points collected: {currentEpisodeData.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episode History Graph */}
      <div style={{ marginTop: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
          Social Interactions Over Episodes ({episodeHistory.length} completed)
        </h2>
        {episodeHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={episodeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="episode" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cooperations" stroke="#4caf50" strokeWidth={2} name="Cooperations" />
              <Line type="monotone" dataKey="thefts" stroke="#f44336" strokeWidth={2} name="Thefts" />
              <Line type="monotone" dataKey="alliances" stroke="#9c27b0" strokeWidth={2} name="Alliances" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏳</div>
              <div>No completed episodes yet</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Complete an episode to see historical trends
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Personality Performance */}
      {episodeHistory.length > 0 && (
        <div style={{ marginTop: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
            Personality Performance (Latest Episode)
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={episodeHistory.slice(-1)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="episode" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="coopScore" fill="#4caf50" name="Cooperative" />
              <Bar dataKey="aggScore" fill="#f44336" name="Aggressive" />
              <Bar dataKey="neuScore" fill="#2196f3" name="Neutral" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Info Box */}
      <div style={{ 
        marginTop: '20px', 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>🌟 Social Dynamics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ color: '#4caf50', margin: '0 0 5px 0' }}>🤝 Cooperative Agents</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Share food with nearby cooperatives</li>
              <li>Form alliances for mutual benefit</li>
              <li>Send help signals to allies</li>
              <li>Get health bonuses in groups</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#f44336', margin: '0 0 5px 0' }}>⚔️ Aggressive Agents</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Steal food from nearby agents</li>
              <li>Focus on solo survival</li>
              <li>Get high rewards for theft</li>
              <li>Risk-reward playstyle</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: '#2196f3', margin: '0 0 5px 0' }}>⚖️ Neutral Agents</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Balanced approach</li>
              <li>Focus on movement and collection</li>
              <li>Don't participate in social actions</li>
              <li>Stable, predictable behavior</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}