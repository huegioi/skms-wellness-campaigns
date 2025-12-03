import React, { useState } from 'react';
import { workforceChallenges } from './catalogData';
import StepNavigation from './StepNavigation';
import { Brain, Users, Target, TrendingUp, DollarSign, Flame, MessageCircle, Monitor, Heart, Crown, Activity, Scale, ChevronDown, ChevronUp } from 'lucide-react';

export default function AssessmentStep({ selections, updateSelections, onNext, isFirstStep }) {
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

  const [showDeeperAssessment, setShowDeeperAssessment] = useState(false);

  const [formData, setFormData] = useState({
    companySize: selections.assessmentData?.companySize || '',
    industry: selections.assessmentData?.industry || '',
    timeline: selections.assessmentData?.timeline || '',
    
    // Section 1: Team Resilience & Engagement
    teamResilience: selections.assessmentData?.teamResilience || '3',
    engagementLevel: selections.assessmentData?.engagementLevel || '3',
    resilienceExample: selections.assessmentData?.resilienceExample || '',
    
    // Section 2: Team Communication & Collaboration
    teamCommunication: selections.assessmentData?.teamCommunication || '3',
    conflictFrequency: selections.assessmentData?.conflictFrequency || '3',
    teamClimateExample: selections.assessmentData?.teamClimateExample || '',
    
    // Section 3: Team Decision-Making & Productivity
    teamDecisionQuality: selections.assessmentData?.teamDecisionQuality || '3',
    teamProductivity: selections.assessmentData?.teamProductivity || '3',
    productivityExample: selections.assessmentData?.productivityExample || '',
    
    // Section 4: Team Alignment & Clarity
    goalAlignment: selections.assessmentData?.goalAlignment || '3',
    performanceClarity: selections.assessmentData?.performanceClarity || '3',
    alignmentBenefits: selections.assessmentData?.alignmentBenefits || '',
    
    // Section 5: Leadership (single section)
    leadershipEffectiveness: selections.assessmentData?.leadershipEffectiveness || '3',
    leadershipEmotionalIntelligence: selections.assessmentData?.leadershipEmotionalIntelligence || '3',
    leadershipExample: selections.assessmentData?.leadershipExample || '',
    
    // Section 6: Overall Goals
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

  const sectionColors = {
    resilience: '#770142',
    communication: '#264d44',
    decision: '#ff9878',
    alignment: '#cae5e3',
    leadership: '#013f7c',
    goals: '#eaf995'
  };

  return (
    <div>
      <style>{`
        .assessment-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        }

        @media (min-width: 768px) {
          .assessment-card {
            padding: 24px;
          }
        }

        .collapsible-header {
          background: white;
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        }

        .collapsible-header:hover {
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        .collapsible-content {
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
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
          font-size: 18px;
          font-weight: 700;
          color: #013f7c;
        }

        @media (min-width: 768px) {
          .section-header h3 {
            font-size: 20px;
          }
        }

        .question-group {
          margin-bottom: 24px;
        }

        .question-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 13px;
        }

        @media (min-width: 768px) {
          .question-label {
            font-size: 14px;
          }
        }

        .scale-container {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        @media (min-width: 768px) {
          .scale-container {
            gap: 16px;
          }
        }

        .scale-label {
          font-size: 12px;
          font-weight: 700;
          color: #441d37;
          min-width: 100px;
          padding: 8px 12px;
          background: rgba(68, 29, 55, 0.08);
          border-radius: 8px;
          text-align: center;
        }

        @media (min-width: 768px) {
          .scale-label {
            font-size: 14px;
            min-width: 120px;
          }
        }

        .scale-buttons {
          display: flex;
          gap: 6px;
          flex: 1;
          justify-content: center;
        }

        @media (min-width: 768px) {
          .scale-buttons {
            gap: 8px;
          }
        }

        .scale-btn {
          background: #f4f0e9;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-weight: 600;
          color: #441d37;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        @media (min-width: 768px) {
          .scale-btn {
            width: 44px;
            height: 44px;
          }
        }

        .scale-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .scale-btn.selected {
          color: white;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .neuro-input, .neuro-select, .neuro-textarea {
          background: #f4f0e9;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          color: #333;
          width: 100%;
          transition: all 0.2s ease;
        }

        .neuro-textarea {
          min-height: 80px;
          resize: vertical;
          font-family: inherit;
        }

        .neuro-input:focus, .neuro-select:focus, .neuro-textarea:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(38, 77, 68, 0.15);
        }

        .challenge-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .challenge-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
          }
        }

        .challenge-card {
          background: white;
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        }

        @media (min-width: 768px) {
          .challenge-card {
            padding: 20px;
          }
        }

        .challenge-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .challenge-card.selected {
          color: white;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.1);
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
          font-size: 11px;
          font-weight: 600;
          margin-left: 8px;
        }

        @media (min-width: 768px) {
          .optional-badge {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Assessment & Goals
        </h2>
        <p className="text-base md:text-lg" style={{ color: '#666' }}>
          Help us understand your team's current state and desired outcomes.
        </p>
      </div>

      {/* Basic Information */}
      <div className="assessment-card">
        <h3 className="text-lg md:text-xl font-bold mb-4" style={{ color: '#013f7c' }}>
          Basic Information <span className="optional-badge">Optional</span>
        </h3>
        
        <div className="question-group">
          <label className="question-label">Company Size (Number of Employees)</label>
          <input
            type="number"
            className="neuro-input"
            placeholder="Enter number of employees..."
            min="1"
            value={formData.companySize}
            onChange={(e) => handleInputChange('companySize', e.target.value)}
          />
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
        <h3 className="text-lg md:text-xl font-bold mb-4" style={{ color: '#264d44' }}>
          Current Workforce Challenges
        </h3>
        <p className="text-sm mb-4" style={{ color: '#666' }}>
          Select all challenges currently affecting your workforce:
        </p>
        
        <div className="challenge-grid">
          {workforceChallenges.map((challenge, index) => {
            const Icon = iconMap[challenge.icon];
            const isSelected = (selections.challenges || []).includes(challenge.id);
            const colors = ['#770142', '#264d44', '#ff9878', '#013f7c', '#cae5e3', '#eaf995', '#441d37'];
            const bgColor = colors[index % colors.length];
            
            return (
              <div
                key={challenge.id}
                className={`challenge-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleChallenge(challenge.id)}
                style={{ background: isSelected ? bgColor : '#f4f0e9' }}
              >
                <div className="challenge-icon" style={{ background: isSelected ? 'rgba(255, 255, 255, 0.2)' : bgColor }}>
                  {Icon && <Icon className="w-6 h-6 text-white" />}
                </div>
                <div className="font-bold text-sm mb-2">{challenge.label}</div>
                <div className="text-xs opacity-80">{challenge.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional Deeper Assessment Toggle */}
      <div 
        className="collapsible-header"
        onClick={() => setShowDeeperAssessment(!showDeeperAssessment)}
      >
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5" style={{ color: '#264d44' }} />
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>Optional Deeper Workforce Assessment</h3>
            <p className="text-sm text-gray-500">Expand for detailed team evaluation questions</p>
          </div>
        </div>
        {showDeeperAssessment ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </div>

      {showDeeperAssessment && (
        <div className="collapsible-content">
          {/* Section 1: Team Resilience & Engagement */}
          <div className="assessment-card">
            <div className="section-header">
              <Brain className="w-5 h-5 md:w-6 md:h-6" style={{ color: sectionColors.resilience }} />
              <h3 style={{ color: sectionColors.resilience }}>Team Resilience & Engagement</h3>
            </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate your team's current adaptability and resilience when facing business challenges?
          </label>
          <div className="scale-container">
            <span className="scale-label">Low</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.teamResilience === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('teamResilience', String(num))}
                  style={{ 
                    background: formData.teamResilience === String(num) ? sectionColors.resilience : '#f4f0e9',
                    borderColor: formData.teamResilience === String(num) ? sectionColors.resilience : 'transparent'
                  }}
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
            How would you rate overall team engagement and morale?
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
                  style={{ 
                    background: formData.engagementLevel === String(num) ? sectionColors.resilience : '#f4f0e9',
                    borderColor: formData.engagementLevel === String(num) ? sectionColors.resilience : 'transparent'
                  }}
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
            Can you describe a recent situation where team resilience or adaptability challenges impacted your organization? (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.resilienceExample}
            onChange={(e) => handleInputChange('resilienceExample', e.target.value)}
          />
        </div>
          </div>

          {/* Section 2: Team Communication & Collaboration */}
          <div className="assessment-card">
            <div className="section-header">
              <Users className="w-5 h-5 md:w-6 md:h-6" style={{ color: sectionColors.communication }} />
              <h3 style={{ color: sectionColors.communication }}>Team Communication & Collaboration</h3>
            </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate your team's communication effectiveness and collaboration?
          </label>
          <div className="scale-container">
            <span className="scale-label">Needs Work</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.teamCommunication === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('teamCommunication', String(num))}
                  style={{ 
                    background: formData.teamCommunication === String(num) ? sectionColors.communication : '#f4f0e9',
                    borderColor: formData.teamCommunication === String(num) ? sectionColors.communication : 'transparent'
                  }}
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
            How frequently do conflicts or escalations occur within teams?
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
                  style={{ 
                    background: formData.conflictFrequency === String(num) ? sectionColors.communication : '#f4f0e9',
                    borderColor: formData.conflictFrequency === String(num) ? sectionColors.communication : 'transparent'
                  }}
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
            Describe a recent challenge related to team communication or collaboration: (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.teamClimateExample}
            onChange={(e) => handleInputChange('teamClimateExample', e.target.value)}
          />
        </div>
          </div>

          {/* Section 3: Team Decision-Making & Productivity */}
          <div className="assessment-card">
            <div className="section-header">
              <Target className="w-5 h-5 md:w-6 md:h-6" style={{ color: sectionColors.decision }} />
              <h3 style={{ color: sectionColors.decision }}>Team Decision-Making & Productivity</h3>
            </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate the current quality and timeliness of team decisions?
          </label>
          <div className="scale-container">
            <span className="scale-label">Poor</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.teamDecisionQuality === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('teamDecisionQuality', String(num))}
                  style={{ 
                    background: formData.teamDecisionQuality === String(num) ? sectionColors.decision : '#f4f0e9',
                    borderColor: formData.teamDecisionQuality === String(num) ? sectionColors.decision : 'transparent'
                  }}
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
            How would you rate your team's overall productivity and efficiency?
          </label>
          <div className="scale-container">
            <span className="scale-label">Low</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.teamProductivity === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('teamProductivity', String(num))}
                  style={{ 
                    background: formData.teamProductivity === String(num) ? sectionColors.decision : '#f4f0e9',
                    borderColor: formData.teamProductivity === String(num) ? sectionColors.decision : 'transparent'
                  }}
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
            Describe a recent productivity or decision-making challenge: (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.productivityExample}
            onChange={(e) => handleInputChange('productivityExample', e.target.value)}
          />
        </div>
          </div>

          {/* Section 4: Team Alignment & Goal Clarity */}
          <div className="assessment-card">
            <div className="section-header">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#013f7c' }} />
              <h3 style={{ color: '#013f7c' }}>Team Alignment & Goal Clarity</h3>
            </div>

        <div className="question-group">
          <label className="question-label">
            How well do team goals currently align with broader organizational objectives?
          </label>
          <div className="scale-container">
            <span className="scale-label">Poorly</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.goalAlignment === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('goalAlignment', String(num))}
                  style={{ 
                    background: formData.goalAlignment === String(num) ? '#013f7c' : '#f4f0e9',
                    borderColor: formData.goalAlignment === String(num) ? '#013f7c' : 'transparent'
                  }}
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
                  style={{ 
                    background: formData.performanceClarity === String(num) ? '#013f7c' : '#f4f0e9',
                    borderColor: formData.performanceClarity === String(num) ? '#013f7c' : 'transparent'
                  }}
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
            What benefits would better alignment and goal clarity bring to your teams? (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="e.g., improved cross-functional collaboration, better resource allocation..."
            value={formData.alignmentBenefits}
            onChange={(e) => handleInputChange('alignmentBenefits', e.target.value)}
          />
        </div>
          </div>

          {/* Section 5: Leadership */}
          <div className="assessment-card">
            <div className="section-header">
              <Crown className="w-5 h-5 md:w-6 md:h-6" style={{ color: sectionColors.leadership }} />
              <h3 style={{ color: sectionColors.leadership }}>Leadership Effectiveness</h3>
            </div>

        <div className="question-group">
          <label className="question-label">
            How would you rate your leaders' overall effectiveness in managing and inspiring their teams?
          </label>
          <div className="scale-container">
            <span className="scale-label">Needs Work</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.leadershipEffectiveness === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('leadershipEffectiveness', String(num))}
                  style={{ 
                    background: formData.leadershipEffectiveness === String(num) ? sectionColors.leadership : '#f4f0e9',
                    borderColor: formData.leadershipEffectiveness === String(num) ? sectionColors.leadership : 'transparent'
                  }}
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
            How would you rate your leaders' emotional intelligence and people management skills?
          </label>
          <div className="scale-container">
            <span className="scale-label">Low</span>
            <div className="scale-buttons">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`scale-btn ${formData.leadershipEmotionalIntelligence === String(num) ? 'selected' : ''}`}
                  onClick={() => handleInputChange('leadershipEmotionalIntelligence', String(num))}
                  style={{ 
                    background: formData.leadershipEmotionalIntelligence === String(num) ? sectionColors.leadership : '#f4f0e9',
                    borderColor: formData.leadershipEmotionalIntelligence === String(num) ? sectionColors.leadership : 'transparent'
                  }}
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
            Describe a leadership challenge or area where development would be beneficial: (Optional)
          </label>
          <textarea
            className="neuro-textarea"
            placeholder="Share specific examples or observations..."
            value={formData.leadershipExample}
            onChange={(e) => handleInputChange('leadershipExample', e.target.value)}
          />
        </div>
          </div>

          {/* Section 6: Overall Goals */}
          <div className="assessment-card">
            <div className="section-header">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6" style={{ color: sectionColors.goals }} />
              <h3 style={{ color: '#264d44' }}>Overall Program Goals</h3>
            </div>

            <div className="question-group">
              <label className="question-label">
                What are your primary goals for implementing a mental fitness program?
              </label>
              <textarea
                className="neuro-textarea"
                placeholder="e.g., reduce burnout, improve team effectiveness, enhance collaboration..."
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
        </div>
      )}

      <StepNavigation
        onNext={handleNext}
        onBack={null}
        nextLabel="Continue to Workshops"
        isFirstStep={isFirstStep}
      />
    </div>
  );
}