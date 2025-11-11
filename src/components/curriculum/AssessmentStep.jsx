
import React, { useState } from 'react';
import { workforceChallenges } from './catalogData';
import StepNavigation from './StepNavigation';
import { Brain, Users, Target, TrendingUp, DollarSign, Flame, MessageCircle, Monitor, Heart, Crown, Activity, Scale } from 'lucide-react';

export default function AssessmentStep({ selections, updateSelections, onNext, isFirstStep }) {
  // Icon mapping for workforce challenges
  const iconMap = {
    Flame: Flame,
    MessageCircle: MessageCircle,
    Monitor: Monitor,
    Heart: Heart,
    TrendingUp: TrendingUp,
    Crown: Crown,
    Activity: Activity,
    Scale: Scale
  };

  const [formData, setFormData] = useState({
    companySize: selections.assessmentData?.companySize || '',
    industry: selections.assessmentData?.industry || '',
    timeline: selections.assessmentData?.timeline || '',
    
    // Section 1: Resilience & Engagement
    resilienceLevel: selections.assessmentData?.resilienceLevel || '3',
    engagementLevel: selections.assessmentData?.engagementLevel || '3',
    resilienceExample: selections.assessmentData?.resilienceExample || '',
    
    // Section 2: Emotional Intelligence & Team Climate
    emotionalIntelligence: selections.assessmentData?.emotionalIntelligence || '3',
    conflictFrequency: selections.assessmentData?.conflictFrequency || '3',
    teamClimateExample: selections.assessmentData?.teamClimateExample || '',
    
    // Section 3: Decision-Making & Strategic Thinking
    decisionQuality: selections.assessmentData?.decisionQuality || '3',
    strategicThinking: selections.assessmentData?.strategicThinking || '3',
    decisionExample: selections.assessmentData?.decisionExample || '',
    
    // Section 4: Alignment & Goal Clarity
    goalAlignment: selections.assessmentData?.goalAlignment || '3',
    performanceClarity: selections.assessmentData?.performanceClarity || '3',
    alignmentBenefits: selections.assessmentData?.alignmentBenefits || '',
    
    // Section 5: Overall Goals
    primaryGoals: selections.assessmentData?.primaryGoals || '',
    successMetrics: selections.assessmentData?.successMetrics || ''
  });

  const toggleChallenge = (challengeId) => {
    const current = selections.challenges || [];
    if (current.includes(challengeId)) {
      updateSelections('challenges', current.filter(id => id !== challengeId));
    } else {
      updateSelections('challenges', [...current, challengeId]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    updateSelections('assessmentData', formData);
    onNext();
  };

  return (
    <div>
      <style>{`
        .assessment-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(1, 63, 124, 0.2);
        }

        .section-header h3 {
          font-size: 20px;
          font-weight: 700;
          color: #013f7c;
        }

        .question-group {
          margin-bottom: 24px;
        }

        .question-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .scale-container {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .scale-label {
          font-size: 12px;
          color: #666;
          min-width: 100px;
        }

        .scale-buttons {
          display: flex;
          gap: 8px;
          flex: 1;
          justify-content: center;
        }

        .scale-btn {
          background: #f4f0e9;
          border: 2px solid transparent;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-weight: 600;
          color: #441d37;
          cursor: pointer;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }

        .scale-btn:hover {
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.15),
            -3px -3px 6px rgba(255, 255, 255, 0.95);
        }

        .scale-btn.selected {
          background: #441d37;
          color: white;
          border-color: #441d37;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.3),
            inset -3px -3px 6px rgba(255, 255, 255, 0.1);
        }

        .neuro-input, .neuro-select, .neuro-textarea {
          background: #f4f0e9;
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          color: #333;
          width: 100%;
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.1),
            inset -4px -4px 8px rgba(255, 255, 255, 0.8);
          transition: all 0.2s ease;
        }

        .neuro-textarea {
          min-height: 80px;
          resize: vertical;
          font-family: inherit;
        }

        .neuro-input:focus, .neuro-select:focus, .neuro-textarea:focus {
          outline: none;
          box-shadow: 
            inset 5px 5px 10px rgba(0, 0, 0, 0.12),
            inset -5px -5px 10px rgba(255, 255, 255, 0.9);
        }

        .challenge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .challenge-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.9);
        }

        .challenge-card:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.15),
            -8px -8px 16px rgba(255, 255, 255, 0.95);
        }

        .challenge-card.selected {
          background: #441d37;
          color: white;
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.3),
            inset -4px -4px 8px rgba(255, 255, 255, 0.05);
        }

        .challenge-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #013f7c, #441d37);
        }

        .challenge-card.selected .challenge-icon {
          background: rgba(255, 255, 255, 0.2);
        }

        .optional-badge {
          display: inline-block;
          background: rgba(68, 29, 55, 0.1);
          color: #441d37;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 8px;
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Assessment & Goals
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          Help us understand your organization's current state and desired outcomes.
        </p>
      </div>

      {/* Basic Information */}
      <div className="assessment-card">
        <h3 className="text-xl font-bold mb-4" style={{ color: '#013f7c' }}>
          Basic Information <span className="optional-badge">Optional</span>
        </h3>
        
        <div className="question-group">
          <label className="question-label">Company Size (Number of Employees)</label>
          <select 
            className="neuro-select"
            value={formData.companySize}
            onChange={(e) => handleInputChange('companySize', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="1-50">1-50</option>
            <option value="51-200">51-200</option>
            <option value="201-500">201-500</option>
            <option value="501-1000">501-1,000</option>
            <option value="1001-5000">1,001-5,000</option>
            <option value="5000+">5,000+</option>
          </select>
        </div>

        <div className="question-group">
          <label className="question-label">Industry</label>
          <input
            type="text"
            className="neuro-input"
            placeholder="e.g., Healthcare, Technology, Finance..."
            value={formData.industry}
            onChange={(e) => handleInputChange('industry', e.target.value)}
          />
        </div>

        <div className="question-group">
          <label className="question-label">Implementation Timeline</label>
          <select 
            className="neuro-select"
            value={formData.timeline}
            onChange={(e) => handleInputChange('timeline', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="immediate">Immediate (Within 1 month)</option>
            <option value="1-3months">1-3 months</option>
            <option value="3-6months">3-6 months</option>
            <option value="6-12months">6-12 months</option>
            <option value="exploring">Just exploring options</option>
          </select>
        </div>
      </div>

      {/* Workforce Challenges */}
      <div className="assessment-card">
        <h3 className="text-xl font-bold mb-4" style={{ color: '#013f7c' }}>
          Current Workforce Challenges
        </h3>
        <p className="text-sm mb-4" style={{ color: '#666' }}>
          Select all challenges currently affecting your workforce:
        </p>
        
        <div className="challenge-grid">
          {workforceChallenges.map((challenge) => {
            const Icon = iconMap[challenge.icon];
            const isSelected = (selections.challenges || []).includes(challenge.id);
            
            return (
              <div
                key={challenge.id}
                className={`challenge-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleChallenge(challenge.id)}
              >
                <div className="challenge-icon">
                  {Icon && <Icon className="w-6 h-6 text-white" />}
                </div>
                <div className="font-bold text-sm mb-2">{challenge.label}</div>
                <div className="text-xs opacity-80">{challenge.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 1: Resilience & Engagement */}
      <div className="assessment-card">
        <div className="section-header">
          <Brain className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h3>Resilience & Engagement <span className="optional-badge">Optional</span></h3>
        </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate your leaders' current adaptability and resilience when facing business challenges?
          </label>
          <div className="scale-container">
            <span className="scale-label">Low</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.resilienceLevel === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('resilienceLevel', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">High</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate overall engagement and morale across your leadership teams?
          </label>
          <div className="scale-container">
            <span className="scale-label">Low</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.engagementLevel === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('engagementLevel', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">High</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            Can you describe a recent situation where resilience or adaptability challenges impacted your organization? (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.resilienceExample}
            onChange={(e) => handleInputChange('resilienceExample', e.target.value)}
          />
        </div>
      </div>

      {/* Section 2: Emotional Intelligence & Team Climate */}
      <div className="assessment-card">
        <div className="section-header">
          <Users className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h3>Emotional Intelligence & Team Climate <span className="optional-badge">Optional</span></h3>
        </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate your leaders' current emotional intelligence and conflict management skills?
          </label>
          <div className="scale-container">
            <span className="scale-label">Needs Work</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.emotionalIntelligence === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('emotionalIntelligence', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Excellent</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            How frequently do conflicts or escalations occur within your leadership teams or their departments?
          </label>
          <div className="scale-container">
            <span className="scale-label">Very Often</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.conflictFrequency === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('conflictFrequency', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Rarely</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            Describe a recent challenge related to team climate, communication, or conflict management: (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.teamClimateExample}
            onChange={(e) => handleInputChange('teamClimateExample', e.target.value)}
          />
        </div>
      </div>

      {/* Section 3: Decision-Making & Strategic Thinking */}
      <div className="assessment-card">
        <div className="section-header">
          <Target className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h3>Decision-Making & Strategic Thinking <span className="optional-badge">Optional</span></h3>
        </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate the current quality and timeliness of strategic decisions made by your leaders?
          </label>
          <div className="scale-container">
            <span className="scale-label">Poor</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.decisionQuality === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('decisionQuality', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Excellent</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            How structured and strategic is your leaders' approach to complex problem-solving?
          </label>
          <div className="scale-container">
            <span className="scale-label">Reactive</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.strategicThinking === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('strategicThinking', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Strategic</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            Describe a recent decision-making challenge or missed opportunity: (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.decisionExample}
            onChange={(e) => handleInputChange('decisionExample', e.target.value)}
          />
        </div>
      </div>

      {/* Section 4: Alignment & Goal Clarity */}
      <div className="assessment-card">
        <div className="section-header">
          <TrendingUp className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h3>Organizational Alignment & Goal Clarity <span className="optional-badge">Optional</span></h3>
        </div>

        <div className="question-group">
          <label className="question-label">
            How well do team goals currently align with broader organizational objectives?
          </label>
          <div className="scale-container">
            <span className="scale-label">Poorly Aligned</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.goalAlignment === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('goalAlignment', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Well Aligned</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            How clear are performance expectations and success metrics across your teams?
          </label>
          <div className="scale-container">
            <span className="scale-label">Unclear</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.performanceClarity === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('performanceClarity', String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="scale-label">Very Clear</span>
          </div>
        </div>

        <div className="question-group">
          <label className="question-label">
            What benefits would better alignment and goal clarity bring to your organization? (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="e.g., improved cross-functional collaboration, better resource allocation..."
            value={formData.alignmentBenefits}
            onChange={(e) => handleInputChange('alignmentBenefits', e.target.value)}
          />
        </div>
      </div>

      {/* Section 5: Overall Goals */}
      <div className="assessment-card">
        <div className="section-header">
          <DollarSign className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h3>Overall Program Goals <span className="optional-badge">Optional</span></h3>
        </div>

        <div className="question-group">
          <label className="question-label">
            What are your primary goals for implementing a mental fitness program?
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="e.g., reduce burnout, improve leadership effectiveness, enhance team collaboration..."
            value={formData.primaryGoals}
            onChange={(e) => handleInputChange('primaryGoals', e.target.value)}
          />
        </div>

        <div className="question-group">
          <label className="question-label">
            How will you measure success? What metrics or outcomes matter most?
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="e.g., employee engagement scores, retention rates, productivity metrics..."
            value={formData.successMetrics}
            onChange={(e) => handleInputChange('successMetrics', e.target.value)}
          />
        </div>
      </div>

      <StepNavigation
        onNext={handleNext}
        onBack={null}
        nextLabel="Continue to Workshops"
        isFirstStep={isFirstStep}
      />
    </div>
  );
}
