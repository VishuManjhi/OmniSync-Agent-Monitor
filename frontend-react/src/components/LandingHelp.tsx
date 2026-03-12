import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchHelpContent, submitPublicFeedback } from '../api/public';
import '../styles/landingHelp.css';

const SUPPORT_EMAIL = 'support@restroboard.com';

const PRODUCT_FEATURES = [
    {
        title: '📧 Email-to-Ticket Automation',
        description: 'Automatically convert inbound support emails into actionable tickets with intelligent parsing and categorization.'
    },
    {
        title: '⚖️ Intelligent Triage System',
        description: 'Weighted priority scoring for FOH, BOH, KIOSK, and other categories ensures critical issues get immediate attention.'
    },
    {
        title: '💡 AI-Powered Solutions',
        description: 'Top-3 historical solution suggestions based on ticket similarity help agents resolve issues faster with proven fixes.'
    },
    {
        title: '👥 Collaborative Ticket Rooms',
        description: 'Real-time collaboration with primary ownership model - invite colleagues to complex tickets while maintaining accountability.'
    },
    {
        title: '📊 Advanced Analytics & SLA',
        description: 'Comprehensive supervisor dashboard with real-time metrics, SLA breach monitoring, and automated escalation workflows.'
    },
    {
        title: '⚙️ Async Job Processing',
        description: 'Background job queue for reports, bulk operations, and email notifications without blocking your workflow.'
    },
    {
        title: '🔐 Team-Based Access Control',
        description: 'Organize agents into supervisor-led teams with role-based permissions and granular access management.'
    },
    {
        title: '📱 Real-Time Updates',
        description: 'WebSocket-powered live notifications ensure your team always has the latest ticket status and assignments.'
    },
    {
        title: '📈 Performance Tracking',
        description: 'Track Average Handle Time (AHT), resolution rates, agent productivity, and team performance metrics in real-time.'
    }
];

const LandingHelp: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState<'general' | 'feature' | 'bug' | 'support'>('general');
    const [message, setMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['public-help-content'],
        queryFn: fetchHelpContent
    });

    const feedbackMutation = useMutation({
        mutationFn: submitPublicFeedback,
        onSuccess: () => {
            setName('');
            setEmail('');
            setCategory('general');
            setMessage('');
            setStatusMessage('Thanks — your feedback was submitted successfully.');
        },
        onError: (err: unknown) => {
            const messageText = err instanceof Error ? err.message : 'Failed to submit feedback';
            setStatusMessage(messageText);
        }
    });

    const buildMailto = (subjectContext: string) => {
        const subject = encodeURIComponent(`[RestroBoard] ${subjectContext}`);
        const body = encodeURIComponent(
            'Hi Support Team,\n\nIssue Summary:\n- \n\nExpected Behavior:\n- \n\nActual Behavior:\n- \n\nSteps/Screenshots:\n- \n\nRegards,\n'
        );
        return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    };

    const handleCopySupportEmail = async () => {
        try {
            await navigator.clipboard.writeText(SUPPORT_EMAIL);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setStatusMessage('Unable to copy support email.');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage('');
        feedbackMutation.mutate({ name, email, category, message });
    };

    return (
        <div className="landing-page">
            <section className="landing-hero">
                <div className="landing-topbar">
                    <div className="landing-brand">RestroBoard | Help Center</div>
                    <div className="landing-links">
                        <a href="#features">Features</a>
                        <a href="#faqs">FAQs</a>
                        <a href="#cases">Case Studies</a>
                        <a href="#feedback">Feedback</a>
                    </div>
                    <div className="landing-top-actions">
                        <button className="landing-btn landing-btn-light" onClick={() => navigate('/login')}>Log In</button>
                        <button className="landing-btn landing-btn-accent" onClick={() => navigate('/login')}>Get Started</button>
                    </div>
                </div>

                <h1 className="landing-title">How can we help?</h1>
                <div className="landing-search-wrap">
                    <input className="landing-search" placeholder="Search troubleshooting, workflows, and guides" />
                </div>
                <div className="landing-chip-row">
                    <span className="landing-chip-label">Top searches</span>
                    <span className="landing-chip">Assignment</span>
                    <span className="landing-chip">Ticket Rooms</span>
                    <span className="landing-chip">Top 3 Solutions</span>
                    <span className="landing-chip">Email Flow</span>
                    <span className="landing-chip">Reports</span>
                </div>
                <div className="landing-cta-row">
                    <a className="landing-btn landing-btn-accent" href={buildMailto('Production Incident')}>Report an Issue</a>
                    <a className="landing-btn landing-btn-dark" href={buildMailto('General Support')}>Contact Support</a>
                    <button className="landing-btn landing-btn-copy" onClick={handleCopySupportEmail}>
                        {copied ? 'Copied' : 'Copy Support Email'}
                    </button>
                </div>
            </section>

            <section className="landing-section" id="features">
                <h2 className="landing-section-title">What RestroBoard Provides</h2>
                <p className="landing-section-subtitle">
                    A comprehensive ticketing platform built for modern restaurant support operations with real-time collaboration and intelligent automation.
                </p>
                <div className="landing-feature-grid">
                    {PRODUCT_FEATURES.map((feature) => (
                        <article key={feature.title} className="landing-card landing-feature-card">
                            <h3 className="landing-card-title">{feature.title}</h3>
                            <p className="landing-card-body">{feature.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section">
                <h2 className="landing-section-title">New to OmniSync? Start here.</h2>
                <div className="landing-start-grid">
                    <article className="landing-start-card">
                        <div className="landing-start-thumb landing-thumb-one" />
                        <p>Getting started with ticket assignment</p>
                    </article>
                    <article className="landing-start-card">
                        <div className="landing-start-thumb landing-thumb-two" />
                        <p>Video tutorials for supervisors</p>
                    </article>
                    <article className="landing-start-card">
                        <div className="landing-start-thumb landing-thumb-three" />
                        <p>Navigating the agent command centre</p>
                    </article>
                </div>
            </section>

            <section className="landing-section" id="faqs">
                <h2 className="landing-section-title">FAQs</h2>
                {isLoading ? (
                    <p className="landing-muted">Loading help content...</p>
                ) : (
                    <div className="landing-grid">
                        {(data?.faqs || []).map((item, index) => (
                            <article key={`faq-${index}`} className="landing-card">
                                <h3 className="landing-card-title">{item.question}</h3>
                                <p className="landing-card-body">{item.answer}</p>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="landing-section" id="cases">
                <h2 className="landing-section-title">Case Studies</h2>
                <div className="landing-grid">
                    {(data?.caseStudies || []).map((item, index) => (
                        <article key={`case-${index}`} className="landing-card">
                            <h3 className="landing-card-title">{item.title}</h3>
                            <p className="landing-card-body">{item.summary}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section" id="feedback">
                <h2 className="landing-section-title">Share Feedback</h2>
                <form onSubmit={handleSubmit} className="landing-form">
                    <input className="landing-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <input className="landing-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <select className="landing-input" value={category} onChange={(e) => setCategory(e.target.value as 'general' | 'feature' | 'bug' | 'support')}>
                        <option value="general">General</option>
                        <option value="feature">Feature</option>
                        <option value="bug">Bug</option>
                        <option value="support">Support</option>
                    </select>
                    <textarea className="landing-input landing-textarea" placeholder="Your feedback" value={message} onChange={(e) => setMessage(e.target.value)} required />
                    <button className="landing-btn landing-btn-accent" type="submit" disabled={feedbackMutation.isPending}>{feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}</button>
                    {statusMessage && <p className="landing-form-status">{statusMessage}</p>}
                </form>
                <p className="landing-support-note">Need urgent help? <a href={buildMailto('Urgent Support Request')}>{SUPPORT_EMAIL}</a></p>
            </section>
        </div>
    );
};

export default LandingHelp;
