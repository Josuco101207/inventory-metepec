import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import Header from '../components/Header';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  TrendingDown, DollarSign, Zap, Package, BarChart3, Activity, ArrowLeft, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './AnalyticsView.css';

const AnalyticsView = () => {
  const { items, movements } = useInventory();
  const navigate = useNavigate();
  const [selectedItemId, setSelectedItemId] = useState('');
  
  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedItemId), 
    [items, selectedItemId]
  );

  const itemMovements = useMemo(() => 
    movements.filter(m => m.itemId === selectedItemId || m.item === selectedItem?.name),
    [movements, selectedItemId, selectedItem]
  );

  const analyticsData = useMemo(() => {
    if (!selectedItem || itemMovements.length === 0) return null;

    // Consumption over time (Salidas + Préstamos)
    const dailyData = {};
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    last30Days.forEach(date => dailyData[date] = { date, qty: 0, cost: 0 });

    itemMovements.forEach(m => {
      if (!m.timestamp) return;
      const date = m.timestamp.toDate().toISOString().split('T')[0];
      if (dailyData[date]) {
        if (m.action === 'Salida' || m.action === 'Préstamo') {
          const qty = Number(m.qty) || 0;
          dailyData[date].qty += qty;
          dailyData[date].cost += qty * (selectedItem.costo_unitario || 0);
        }
      }
    });

    const chartData = Object.values(dailyData);
    const totalConsumed = chartData.reduce((acc, d) => acc + d.qty, 0);
    const totalCost = chartData.reduce((acc, d) => acc + d.cost, 0);
    
    // Usage frequency (How many days had movements in last 30 days)
    const activeDays = chartData.filter(d => d.qty > 0).length;
    const frequencyScore = (activeDays / 30) * 100;

    // Estimation of next order
    const avgDaily = totalConsumed / 30;
    const daysLeft = avgDaily > 0 ? (selectedItem.qty || 0) / avgDaily : 999;
    const nextOrderDate = new Date();
    nextOrderDate.setDate(nextOrderDate.getDate() + Math.round(daysLeft));

    return {
      chartData,
      totalConsumed,
      totalCost,
      frequencyScore,
      avgDaily,
      nextOrderDate: daysLeft < 999 ? nextOrderDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'N/A'
    };
  }, [selectedItem, itemMovements]);

  return (
    <div className="analytics-view">
      <Header />
      
      <div className="analytics-container">
        <header className="analytics-header">
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> REGRESAR
          </button>
          <h2 className="analytics-title">Analítica Milimétrica</h2>
          <p className="analytics-subtitle">Precisión absoluta sobre el consumo y gasto por artículo.</p>
        </header>

        <section className="item-selector-card">
          <div className="selector-icon-box">
            <Package size={24} />
          </div>
          <div className="selector-content">
            <label className="selector-label">Seleccionar Artículo para Analizar</label>
            <div className="selector-select-wrapper">
              <select 
                className="selector-select"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
              >
                <option value="">Buscar artículo...</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.category})</option>
                ))}
              </select>
              <ChevronDown size={20} className="selector-chevron" />
            </div>
          </div>
          {selectedItem && (
            <div className="selector-stock-info">
              <p className="stock-info-label">Stock Actual</p>
              <p className="stock-info-value">{selectedItem.qty} <span style={{fontSize:'1rem', color:'#86868b'}}>{selectedItem.unit}</span></p>
            </div>
          )}
        </section>

        {analyticsData ? (
          <div className="analytics-grid">
            {/* Summary Stats */}
            <div className="col-12 stats-row">
              <div className="stat-box">
                <span className="label">Consumo (30d)</span>
                <span className="value">{analyticsData.totalConsumed} <span style={{fontSize:'1rem', color:'#86868b'}}>{selectedItem.unit}</span></span>
                <div className="stat-footer success">
                  <TrendingDown size={14} /> Flujo constante
                </div>
              </div>
              <div className="stat-box">
                <span className="label">Inversión (30d)</span>
                <span className="value">${analyticsData.totalCost.toLocaleString()}</span>
                <span className="stat-footer muted">Basado en costo unitario</span>
              </div>
              <div className="stat-box">
                <span className="label">Frecuencia de Uso</span>
                <span className="value">{analyticsData.frequencyScore.toFixed(1)}%</span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${analyticsData.frequencyScore}%` }}></div>
                </div>
              </div>
              <div className="stat-box dark">
                <span className="label">Próximo Pedido</span>
                <span className="value">{analyticsData.nextOrderDate}</span>
                <span className="stat-footer accent">Predicción Milimétrica</span>
              </div>
            </div>

            {/* Consumption Chart */}
            <div className="col-8 chart-card">
              <h3><Activity size={20} className="blue" /> Curva de Consumo Diario</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.chartData}>
                    <defs>
                      <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0071e3" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0071e3" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(str) => str.split('-')[2]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#86868b' }} 
                    />
                    <YAxis hide />
                    <Tooltip 
                      labelStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} 
                    />
                    <Area type="monotone" dataKey="qty" stroke="#0071e3" strokeWidth={4} fillOpacity={1} fill="url(#colorQty)" dot={{r: 4, fill: '#0071e3', strokeWidth: 2, stroke: '#fff'}} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost Chart */}
            <div className="col-4 chart-card">
              <h3><DollarSign size={20} className="green" /> Gasto Acumulado</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(str) => str.split('-')[2]} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#86868b' }} 
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} 
                    />
                    <Bar dataKey="cost" fill="#34c759" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights Section */}
            <div className="col-12 insight-box">
              <div className="insight-content">
                <h4>Insight Inteligente</h4>
                <p>
                  El artículo <strong>{selectedItem.name}</strong> tiene un consumo promedio de <strong>{analyticsData.avgDaily.toFixed(2)} {selectedItem.unit}/día</strong>. 
                  Al ritmo actual, tu inventario se agotará en aproximadamente {Math.round(analyticsData.totalConsumed / 30 * 30)} unidades por mes. 
                  Se recomienda programar el próximo reabastecimiento antes del <strong>{analyticsData.nextOrderDate}</strong>.
                </p>
              </div>
              <Zap size={160} className="insight-icon" />
            </div>
          </div>
        ) : (
          <div className="no-data-state">
            <BarChart3 size={80} />
            <h3>Sin Datos Disponibles</h3>
            <p>Selecciona un artículo y asegúrate de que tenga movimientos en los últimos 30 días.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;
