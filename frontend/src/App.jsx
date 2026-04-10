import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  HeartPulse, Activity, MessageSquare, Info, User,
  Download, Send, Loader2, AlertCircle, TrendingUp,
  Mail, Globe, MapPin
} from 'lucide-react';

const GithubIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.24c3-.34 6-1.53 6-6.76a5.34 5.34 0 0 0-1.5-3.7 4.9 4.9 0 0 0-.14-3.6s-1.17-.4-3.9 1.4a13.3 13.3 0 0 0-7 0c-2.73-1.8-3.9-1.4-3.9-1.4a4.9 4.9 0 0 0-.14 3.6 5.34 5.34 0 0 0-1.5 3.7c0 5.22 3 6.42 6 6.76a4.8 4.8 0 0 0-1 3.24v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>;
const LinkedinIcon = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>;
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API_BASE = import.meta.env.MODE === 'production' 
  ? 'https://heartguard-analytics-1.onrender.com' 
  : 'http://localhost:8000';

/* Typewriter Effect Component for Chat */
const TypewriterText = ({ text, delay = 15 }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, delay]);
  
  // Also parse markdown if the API returns structured text in chat
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentText}</ReactMarkdown>;
};

function App() {
  const [activeTab, setActiveTab] = useState('diagnostic');
  
  // Predict Form State
  const [formData, setFormData] = useState({
    age: 39, sex: 'Female', cp: 'Typical angina', trestbps: 122, chol: 190,
    fbs: 'False', restecg: 'Normal', thalch: 178, exang: 'No', oldpeak: 0.0,
    slope: 'Upsloping', ca: '0', thal: 'Normal'
  });
  
  // Results State
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // AI Analysis State
  const [analysisText, setAnalysisText] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Cardiology Assistant. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const response = await axios.post(`${API_BASE}/predict`, formData);
        setResult({
            patientData: formData,
            prediction: response.data.prediction,
            probability: response.data.probability,
            shap_values: response.data.shap_values,
            shap_raw: response.data.shap_raw
        });
        
        // Auto-navigate to prediction tab immediately when prediction completes
        setActiveTab('prediction'); 
        
        // Fetch AI in background
        fetchAnalysis({
            prediction: response.data.prediction,
            probability: response.data.probability
        });
    } catch (error) {
        console.error("Prediction error:", error);
        alert("Failed to connect to the analysis engine.");
    } finally {
        setLoading(false);
    }
  };

  const fetchAnalysis = async (predData) => {
    setAnalysisLoading(true);
    try {
        const response = await axios.post(`${API_BASE}/analyze`, predData);
        setAnalysisText(response.data.response);
    } catch (error) {
        setAnalysisText("Failed to generate AI insights. Please check API key.");
    } finally {
        setAnalysisLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newHistory = [...chatHistory, { role: 'user', content: chatInput }];
    setChatHistory(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
        const response = await axios.post(`${API_BASE}/chat`, {
            message: chatInput,
            history: chatHistory.slice(1)
        });
        setChatHistory([...newHistory, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
        setChatHistory([...newHistory, { role: 'assistant', content: "Error connecting to AI service." }]);
    } finally {
        setChatLoading(false);
    }
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
        const response = await axios.post(`${API_BASE}/download_report`, {
            patient_data: result.patientData,
            prediction_label: result.prediction,
            risk_prob: result.probability,
            analysis_text: analysisText
        }, { responseType: 'blob' });

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Heart_Report.pdf');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
    } catch (error) {
        console.error("Download fail:", error);
        alert("Failed to compile or download PDF.");
    } finally {
        setDownloading(false);
    }
  };

  // Recharts formatters
  const PIE_COLORS = ['#d32f2f', '#77dd77'];
  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">
        {name}: {value.toFixed(1)}
      </text>
    );
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <HeartPulse size={32} />
          HeartAI
        </div>
        
        <div 
          className={`nav-item ${activeTab === 'diagnostic' ? 'active' : ''}`}
          onClick={() => setActiveTab('diagnostic')}
        >
          <Activity size={20} /> Form Input
        </div>
        
        {/* Prediction Dashboard appears once generated */}
        {result && (
          <div 
            className={`nav-item ${activeTab === 'prediction' ? 'active' : ''}`}
            onClick={() => setActiveTab('prediction')}
          >
            <TrendingUp size={20} /> Result Dashboard
          </div>
        )}
        
        <div 
          className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <AlertCircle size={20} /> AI Clinical Insights
        </div>
        <div 
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={20} /> Health Chatbot
        </div>
        <div 
          className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <Info size={20} /> About Project
        </div>
        <div 
          className={`nav-item ${activeTab === 'dev' ? 'active' : ''}`}
          onClick={() => setActiveTab('dev')}
        >
          <User size={20} /> Developer
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="main-content">
        {activeTab === 'diagnostic' && (
          <div>
            <h1 className="page-title">Diagnostic Vitals Form</h1>
            <p className="page-subtitle">Enter clinical parameters to assess cardiovascular risk.</p>
            
            <div className="glass-card" style={{ maxWidth: '900px' }}>
              <form onSubmit={handleFormSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Age</label>
                    <input type="number" name="age" value={formData.age} onChange={handleInputChange} min="1" max="120" required />
                  </div>
                  <div className="form-group">
                    <label>Sex</label>
                    <select name="sex" value={formData.sex} onChange={handleInputChange}>
                      <option>Female</option>
                      <option>Male</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Chest Pain Type</label>
                    <select name="cp" value={formData.cp} onChange={handleInputChange}>
                      <option>Typical angina</option>
                      <option>Atypical angina</option>
                      <option>Non-anginal</option>
                      <option>Asymptomatic</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Resting BP</label>
                    <input type="number" name="trestbps" value={formData.trestbps} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Cholesterol</label>
                    <input type="number" name="chol" value={formData.chol} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>FBS &gt; 120</label>
                    <select name="fbs" value={formData.fbs} onChange={handleInputChange}>
                      <option>False</option>
                      <option>True</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Resting ECG</label>
                    <select name="restecg" value={formData.restecg} onChange={handleInputChange}>
                      <option>Normal</option>
                      <option>ST-T wave abnormality</option>
                      <option>Left ventricular hypertrophy</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Max Heart Rate</label>
                    <input type="number" name="thalch" value={formData.thalch} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Exercise Angina</label>
                    <select name="exang" value={formData.exang} onChange={handleInputChange}>
                      <option>No</option>
                      <option>Yes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>ST Depression (Oldpeak)</label>
                    <input type="number" step="0.1" name="oldpeak" value={formData.oldpeak} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>ST Slope</label>
                    <select name="slope" value={formData.slope} onChange={handleInputChange}>
                      <option>Upsloping</option>
                      <option>Flat</option>
                      <option>Downsloping</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Major Vessels (CA)</label>
                    <select name="ca" value={formData.ca} onChange={handleInputChange}>
                      <option>0</option><option>1</option><option>2</option><option>3</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Thalassemia</label>
                    <select name="thal" value={formData.thal} onChange={handleInputChange}>
                      <option>Normal</option>
                      <option>Fixed defect</option>
                      <option>Reversable defect</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? <><Loader2 className="loading-spinner" size={18} style={{verticalAlign: 'middle', marginRight: '8px'}}/> Running Analysis...</> : 'Run Diagnostic Analysis'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'prediction' && result && (
          <div className="prediction-dashboard">
            <div className="prediction-top-row">
              {/* Card 1: Probability Distribution */}
              <div className="glass-card">
                 <h3 className="chart-card-title">Probability Distribution</h3>
                 <div className="prob-dist-container">
                    <div className="prob-bar-wrapper">
                        {/* Red block for probability */}
                        <div style={{
                            width: `${result.probability * 100}%`, 
                            backgroundColor: '#d32f2f', 
                            height: '100%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            position: 'absolute',
                            left: 0,
                            paddingLeft: '10px', 
                            color: 'white', 
                            fontWeight: 'bold'
                        }}>
                           {(result.probability * 100).toFixed(1)}%
                        </div>
                        {/* Green block for inverse probability */}
                        <div style={{
                            width: `${(1 - result.probability) * 100}%`, 
                            backgroundColor: '#77dd77', 
                            height: '100%', 
                            position: 'absolute',
                            right: 0
                        }}></div>
                        
                        <div className="prob-bar-ticks">
                          <span>0.0</span>
                          <span>0.2</span>
                          <span>0.4</span>
                          <span>0.6</span>
                          <span>0.8</span>
                          <span>1.0</span>
                        </div>
                    </div>
                 </div>
              </div>
              
              {/* Card 2: Feature Impact */}
              <div className="glass-card">
                 <h3 className="chart-card-title">Feature Impact (Top 10)</h3>
                 <ResponsiveContainer width="100%" height={240}>
                    <BarChart layout="vertical" data={result.shap_values} margin={{top: 5, right: 30, left: 10, bottom: 5}}>
                      <XAxis type="number" fontSize={11} tickLine={false} />
                      <YAxis dataKey="feature" type="category" axisLine={false} tickLine={false} fontSize={11} width={80} />
                      <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                      <Bar dataKey="value" fill="#d32f2f" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>

              {/* Card 3: SHAP Contribution Pie */}
              <div className="glass-card">
                 <h3 className="chart-card-title">SHAP Contribution Balance</h3>
                 <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={[
                            { name: 'Positive Factors', value: result.shap_raw.positive },
                            { name: 'Negative Factors', value: result.shap_raw.negative }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        labelLine={false}
                        label={CustomPieLabel}
                      >
                        <Cell fill={PIE_COLORS[0]} />
                        <Cell fill={PIE_COLORS[1]} />
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Table Data */}
            <div className="glass-card">
              <div className="assistant-explanation-header">
                <AlertCircle size={24} color="#d32f2f"/> Assistant Explanation
              </div>
              <div className="results-table-container">
                 <table>
                   <thead>
                     <tr>
                       <th>Metric</th>
                       <th>Value</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td>Prediction</td>
                       <td style={{fontWeight: 600, color: result.probability >= 0.6 ? '#d32f2f' : '#22c55e'}}>
                         {result.prediction}
                       </td>
                     </tr>
                     <tr>
                       <td>Risk Level</td>
                       <td>{result.probability >= 0.8 ? 'Severe' : (result.probability >= 0.6 ? 'High' : 'Low')}</td>
                     </tr>
                     <tr>
                       <td>Probability</td>
                       <td>{(result.probability * 100).toFixed(1)}%</td>
                     </tr>
                   </tbody>
                 </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div>
            <h1 className="page-title">AI Clinical Insights</h1>
            <p className="page-subtitle">Powered by Groq LLM</p>
            
            <div className="glass-card">
              {analysisLoading ? (
                  <div style={{textAlign: 'center', padding: '40px'}}>
                      <Loader2 className="loading-spinner" size={40} color="var(--primary-color)" style={{marginBottom: '16px'}}/>
                      <p>Generating personalized intelligence report...</p>
                  </div>
              ) : result ? (
                  <>
                      {/* React Markdown renders tables and structured data cleanly. */}
                      <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {analysisText}
                          </ReactMarkdown>
                      </div>
                      
                      <hr style={{margin: '32px 0', borderColor: 'var(--border-color)', borderBottom: 'none'}} />
                      
                      <button onClick={downloadReport} className="btn-primary" disabled={downloading || !analysisText} style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                        {downloading ? <Loader2 className="loading-spinner" size={20} /> : <Download size={20} />}
                        {downloading ? 'Compiling PDF...' : 'Download Full Medical Report'}
                      </button>
                  </>
              ) : (
                  <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Run a diagnostic assessment first to generate insights.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <h1 className="page-title">Health Chatbot</h1>
            <p className="page-subtitle">Ask questions about cardiovascular health</p>
            
            <div className="glass-card chat-container">
              <div className="chat-history">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`chat-message ${msg.role}`}>
                    {msg.role === 'assistant' && i === chatHistory.length - 1 && !chatLoading ? (
                      <TypewriterText text={msg.content} />
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-message assistant">
                    <Loader2 className="loading-spinner" size={16} />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              <form onSubmit={handleChatSubmit} className="chat-input-wrapper">
                <input 
                  type="text" 
                  placeholder="Type your medical query here..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" className="chat-send-btn" disabled={chatLoading || !chatInput.trim()}>
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div>
            <h1 className="page-title">About HeartAI</h1>
            <p className="page-subtitle">Project Overview & Architecture</p>
            
            <div className="glass-card markdown-body">
              <h2>A State-of-the-Art Diagnostic Engine</h2>
              <p>
                HeartAI is an advanced clinical intelligence system that bridges the gap between machine learning and generative AI for medical diagnostics.
              </p>
              
              <h3>Technology Stack</h3>
              <ul>
                <li><strong>Frontend:</strong> React & Vite & Vanilla CSS</li>
                <li><strong>Backend Engine:</strong> Python FastAPI</li>
                <li><strong>Inference Model:</strong> Scikit-Learn Random Forest Pipeline</li>
                <li><strong>Interpretability:</strong> SHAP (SHapley Additive exPlanations) rendered dynamically via Recharts</li>
                <li><strong>Generative Intelligence:</strong> Groq API for lightning fast LLM insights</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'dev' && (
          <div>
            <h1 className="page-title">Developer</h1>
            
            <div className="dev-premium-card">
              <div className="dev-banner"></div>
              <div className="dev-content">
                <img src="/Portfolio%20photo.png" alt="Developer" className="dev-avatar" />
                <div className="dev-header">
                  <h2>Avinash Pawar</h2>
                  <h3 className="dev-title">AI Engineer & Data Scientist</h3>
                  <div className="dev-location"><MapPin size={16}/> PCCOE, Pune</div>
                </div>
                
                <div className="dev-bio">
                  <p>I&apos;m a passionate developer focused on building smart and user-friendly web applications. I enjoy working with modern technologies and applying machine learning to solve real-world problems. With hands-on experience in data analytics and full-stack development, I strive to create impactful digital solutions. I&apos;m always eager to learn, innovate, and take on new challenges.</p>
                </div>

                <div className="dev-skills-section">
                  <h4>Core Technologies</h4>
                  <div className="dev-skills">
                    {["Python", "Java", "C++", "C", "JavaScript", "React", "Scikit-Learn", "FastAPI"].map(skill => (
                      <span key={skill} className="skill-badge">{skill}</span>
                    ))}
                  </div>
                </div>

                <div className="dev-socials">
                  <a href="https://github.com/Avinash14-coder" target="_blank" rel="noreferrer" className="social-icon">
                    <GithubIcon size={24} />
                  </a>
                  <a href="https://www.linkedin.com/in/avinash-pawar-0a19b5347" target="_blank" rel="noreferrer" className="social-icon">
                    <LinkedinIcon size={24} />
                  </a>
                  <a href="mailto:avinash.pawar25@pccoepune.org" className="social-icon">
                    <Mail size={24} />
                  </a>
                  <a href="https://avinash05portfolio.netlify.app/" target="_blank" rel="noreferrer" className="social-icon">
                    <Globe size={24} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
