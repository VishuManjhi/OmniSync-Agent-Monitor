import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
    Mail,
    ShieldCheck,
    Users,
    Settings,
    ChevronRight,
    ChevronLeft,
    HelpCircle,
    Layout,
    MessageCircle,
    TrendingUp,
    Cpu,
    Globe,
    Monitor
} from 'lucide-react';
import { captureLead } from '../api/public';
import '../styles/landingHelp.css';

const PRODUCT_FEATURES = [
    {
        title: 'Email Automation',
        description: 'Automatically convert inbound support emails into actionable tickets with intelligent parsing.',
        icon: <Mail size={32} />,
        color: 'rgba(251, 191, 36, 0.15)'
    },
    {
        title: 'Intelligent Triage',
        description: 'Weighted priority scoring ensures critical issues get immediate attention.',
        icon: <ShieldCheck size={32} />,
        color: 'rgba(56, 189, 248, 0.15)'
    },
    {
        title: 'Collab Rooms',
        description: 'Real-time collaboration - invite coordinators to complex tickets.',
        icon: <Users size={32} />,
        color: 'rgba(168, 85, 247, 0.15)'
    },
    {
        title: 'Deep Analytics',
        description: 'Comprehensive dashboard with real-time metrics and SLA monitoring.',
        icon: <TrendingUp size={32} />,
        color: 'rgba(34, 197, 94, 0.15)'
    },
    {
        title: 'Async Jobs',
        description: 'Background processing for reports without blocking your dashboard.',
        icon: <Cpu size={32} />,
        color: 'rgba(244, 63, 94, 0.15)'
    },
    {
        title: 'Global Sync',
        description: 'Native support for franchise hierarchies and multi-location reporting.',
        icon: <Globe size={32} />,
        color: 'rgba(14, 165, 233, 0.15)'
    }
];

const FAQS = [
    {
        question: "How do I automate ticket assignments?",
        answer: "Assignments are handled through our Intelligent Triage System. Define rules based on FOH or BOH, and route them instantly."
    },
    {
        question: "Can I integrate my existing email?",
        answer: "Yes, RestroBoard supports IMAP/SMTP integration. All incoming emails become tickets automatically."
    },
    {
        question: "How does the Collab Room work?",
        answer: "Every ticket has a dedicated Room. Invite specialists without losing ownership. Real-time chat included."
    },
    {
        question: "What metrics can I track?",
        answer: "Track Average Handle Time (AHT), resolution rates by agent, and SLA compliance via the Analytics module."
    }
];

const CASE_STUDIES = [
    {
        title: "The Grand Bistro Group",
        summary: "Reduced response time by 45% using automation across 20 locations.",
        icon: <Layout size={28} />
    },
    {
        title: "Kitchen Hardware Sync",
        summary: "Prevented equipment downtime during peak seasonal rushes across 12 sites.",
        icon: <Settings size={28} />
    },
    {
        title: "24/7 Kiosk Optimization",
        summary: "Resolved kiosk failures within 15 minutes using WebSocket alerts.",
        icon: <TrendingUp size={28} />
    },
    {
        title: "Franchise Scale-Up",
        summary: "Standardized support workflows for 50+ new franchises in under 3 months.",
        icon: <Monitor size={28} />
    }
];

const FEEDBACK_CATEGORIES = ['general', 'feature', 'bug', 'support'] as const;

function isFeedbackCategory(value: string): value is (typeof FEEDBACK_CATEGORIES)[number] {
    return FEEDBACK_CATEGORIES.includes(value as (typeof FEEDBACK_CATEGORIES)[number]);
}

const LandingHelp: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [category, setCategory] = useState<'general' | 'feature' | 'bug' | 'support'>('general');
    const [message, setMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    // Card Deck State
    const [deckIndex, setDeckIndex] = useState(0);

    const nextCard = () => {
        setDeckIndex((prev) => (prev + 1) % PRODUCT_FEATURES.length);
    };

    const prevCard = () => {
        setDeckIndex((prev) => (prev - 1 + PRODUCT_FEATURES.length) % PRODUCT_FEATURES.length);
    };

    const getCardStyle = (index: number) => {
        const total = PRODUCT_FEATURES.length;
        // Calculate offset so the active card is centered
        const offset = (index - deckIndex + total) % total;

        // Active card (Center)
        if (offset === 0) {
            return {
                transform: 'translateZ(0) scale(1) translateX(0)',
                opacity: 1,
                zIndex: 10,
                pointerEvents: 'auto' as const
            };
        }

        // Cards going into the distance
        if (offset < 4) {
            return {
                transform: `translateZ(${-150 * offset}px) translateY(${-40 * offset}px) rotateX(${-5 * offset}deg) scale(${1 - 0.1 * offset})`,
                opacity: 0.7 - (offset * 0.15),
                zIndex: 10 - offset,
                pointerEvents: 'none' as const
            };
        }

        // Hidden/Recycled
        return {
            transform: 'translateZ(-1000px) scale(0.5)',
            opacity: 0,
            zIndex: 0,
            pointerEvents: 'none' as const
        };
    };

    const feedbackMutation = useMutation({
        mutationFn: captureLead,
        onSuccess: () => {
            setName('');
            setEmail('');
            setCategory('general');
            setMessage('');
            setStatusMessage('Feedback received successfully.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        feedbackMutation.mutate({ name, email, message: `Landing Feedback: ${message}` });
    };

    return (
        <div className="landing-page light-marketing">
            <section className="landing-hero landing-hero-yellow">
                <div className="landing-topbar-wrapper">
                    <nav className="landing-topbar">
                        <div className="brand-group">
                            <div className="landing-brand" onClick={() => navigate('/')}>RestroBoard</div>
                            <div className="live-status">
                                <span className="status-dot"></span> v3.0 is now live
                            </div>
                        </div>
                        <div className="landing-links">
                            <a href="#features">Features</a>
                            <a href="#faqs">FAQs</a>
                            <a href="#cases">Impact</a>
                        </div>
                        <div className="landing-top-actions">
                            <button className="landing-btn" style={{ background: 'transparent', color: 'inherit' }} onClick={() => navigate('/login')}>Login</button>
                            <button className="landing-btn landing-btn-accent" onClick={() => navigate('/pricing')}>Get Started</button>
                        </div>
                    </nav>
                </div>

                <div style={{ textAlign: 'center', maxWidth: '1000px', zIndex: 10, position: 'relative', marginTop: '40px' }}>
                    <h1 className="landing-title opaque-text" style={{ fontSize: '5.5rem', marginBottom: '40px' }}>Manage Your Restaurant Support Operations</h1>
                    <p className="landing-section-subtitle yellow-subtitle" style={{ fontSize: '1.5rem', fontWeight: '300' }}>
                        The ultimate infrastructure for restaurant groups that demand <br /> zero-latency and elite collaboration.
                    </p>
                    <div className="landing-cta-row" style={{ marginTop: '40px' }}>
                        <button className="landing-btn landing-btn-accent" style={{ padding: '22px 56px' }} onClick={() => navigate('/pricing')}>
                            Get restroboard Now <ChevronRight size={22} />
                        </button>
                    </div>
                </div>
            </section>

            <section className="landing-section section-smaller" id="features">
                <div className="section-head tighter">
                    <h2 className="landing-section-title">Engineered for Reliability</h2>
                    <p className="landing-section-subtitle">Navigate through our core pillars of excellence.</p>
                </div>

                <div className="deck-wrapper">
                    <button className="deck-arrow deck-arrow-left" onClick={prevCard} aria-label="Previous">
                        <ChevronLeft size={32} />
                    </button>

                    <div className="deck-container deck-smaller">
                        {PRODUCT_FEATURES.map((feature, i) => (
                            <div
                                key={i}
                                className="deck-card glass-card"
                                style={{
                                    ...getCardStyle(i),
                                    background: deckIndex === i ? feature.color : 'rgba(255,255,255,0.05)',
                                    borderColor: deckIndex === i ? 'var(--primary)' : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <div className="deck-card-icon" style={{ background: '#fff', padding: '20px', borderRadius: '24px', marginBottom: '24px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>{feature.icon}</div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '16px' }}>{feature.title}</h3>
                                <p style={{ fontSize: '1.1rem', color: 'var(--text-dim)', maxWidth: '400px' }}>{feature.description}</p>
                            </div>
                        ))}
                    </div>

                    <button className="deck-arrow deck-arrow-right" onClick={nextCard} aria-label="Next">
                        <ChevronRight size={32} />
                    </button>
                </div>
            </section>

            <section className="landing-section section-smaller" id="faqs" style={{ background: 'var(--surface-alt)', borderRadius: '60px' }}>
                <div className="section-head tighter">
                    <h2 className="landing-section-title">Common Inquiries</h2>
                    <p className="landing-section-subtitle">How we solve hard hospitality problems.</p>
                </div>

                <div className="faq-tree faq-compact">
                    {FAQS.map((faq, i) => (
                        <div key={i} className="faq-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                                <div style={{ color: 'var(--primary)' }}><HelpCircle size={24} /></div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: '900' }}>{faq.question}</h3>
                            </div>
                            <p style={{ fontSize: '1rem', color: 'var(--text-dim)' }}>{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section" id="cases">
                <div className="section-head tighter">
                    <h2 className="landing-section-title">Real Impact</h2>
                    <p className="landing-section-subtitle">Scaling stories from our elite partners.</p>
                </div>
                <div className="case-grid grid-4">
                    {CASE_STUDIES.map((item, index) => (
                        <article key={index} className="case-card compact">
                            <div style={{ color: 'var(--primary)', marginBottom: '24px' }}>{item.icon}</div>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '12px' }}>{item.title}</h3>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>{item.summary}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="landing-section section-smaller" id="feedback">
                <div className="landing-form">
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <h2 className="landing-section-title" style={{ fontSize: '2.5rem' }}>Send Feedback</h2>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <input className="landing-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                            <input className="landing-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <select
                            className="landing-input"
                            value={category}
                            onChange={(e) => {
                                const next = e.target.value;
                                if (isFeedbackCategory(next)) {
                                    setCategory(next);
                                }
                            }}
                        >
                            <option value="general">General</option>
                            <option value="feature">Feature</option>
                            <option value="bug">Bug</option>
                        </select>
                        <textarea className="landing-input" style={{ minHeight: '120px' }} placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} required />
                        <button className="landing-btn landing-btn-accent" type="submit" style={{ justifyContent: 'center' }}>
                            Submit <MessageCircle size={20} />
                        </button>
                        {statusMessage && <p style={{ textAlign: 'center', color: '#10b981', fontWeight: '800', marginTop: '12px' }}>{statusMessage}</p>}
                    </form>
                </div>
            </section>

            <footer style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-dim)', borderTop: '1px solid var(--border)' }}>
                <div className="landing-brand" style={{ marginBottom: '16px' }}>RestroBoard</div>
                <p>&copy; {new Date().getFullYear()} RestroBoard. Premium Support Management Infrastructure.</p>
            </footer>
        </div>
    );
};

export default LandingHelp;
