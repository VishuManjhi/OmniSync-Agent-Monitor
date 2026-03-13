import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
    Check,
    ArrowRight,
    Zap,
    Shield,
    Users,
    Cpu,
    Globe,
    X,
    Mail,
    Layers,
    TrendingUp
} from 'lucide-react';
import { captureLead } from '../api/public';
import '../styles/landingHelp.css';

const ProductInfo: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [showExperience, setShowExperience] = useState(false);
    const [experienceIndex, setExperienceIndex] = useState(0);

    const welcomeSectionRef = useRef<HTMLDivElement>(null);
    const leadFormRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Modal is now strictly manual trigger via VIP button as requested
    }, []);

    const scrollToLead = () => {
        leadFormRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const feedbackMutation = useMutation({
        mutationFn: captureLead,
        onSuccess: () => {
            setEmail('');
            setStatusMessage('Welcome onboard! A premium intro package is being drafted for you.');
        }
    });

    const features = [
        {
            icon: <Zap size={48} />,
            title: 'Mission-Critical Speed',
            desc: 'Our proprietary WebSocket event layer provides sub-100ms synchronization between front-of-house (FOH) and back-of-house (BOH). This ensures that orders, status updates, and critical alerts are delivered instantly, eliminating the latency that plagues traditional POS systems. Experience real-time operational fluidity like never before.'
        },
        {
            icon: <Shield size={48} />,
            title: 'Enterprise Security',
            desc: 'RestroBoard is built on bank-grade security protocols. With granular role-based access control (RBAC), every interaction is logged in an unchangeable audit trail. Protect your sensitive financial data and operational intellectual property with a system designed for large-scale compliance and regulatory standards.'
        },
        {
            icon: <TrendingUp size={48} />,
            title: 'Prescriptive Analytics',
            desc: 'Go beyond historical data. Our analytics engine uses machine learning to identify upcoming bottlenecks before they happen. Monitor labor costs, table turnover, and inventory waste across your entire restaurant group in a single, high-fidelity dashboard. Turn complex data into clear, actionable investment strategies.'
        },
        {
            icon: <Users size={48} />,
            title: 'VIP Collab Rooms',
            desc: 'When critical issues arise, seconds count. Instantly spin up a dedicated Collab Room for any high-priority ticket. Invite area managers, technical specialists, or external vendors into a secure, real-time environment focused on resolution. Full message history and file sharing ensure nothing falls through the cracks.'
        },
        {
            icon: <Cpu size={48} />,
            title: 'Smart Assignment',
            desc: 'Our Intelligent Triage System (ITS) uses weighted scoring algorithms to ensure your most skilled staff are automatically assigned to the most complex operational challenges. Balance workload dynamically across your organization and ensure that every customer touchpoint is handled by the right expert every time.'
        },
        {
            icon: <Globe size={48} />,
            title: 'Global Operations',
            desc: 'Scale without friction. RestroBoard natively supports multi-regional hierarchies, complex franchise structures, and diverse currency/tax requirements. Standardize your SOPs across 100+ locations while maintaining local flexibility. Manage your global footprint from a single centralized command center.'
        }
    ];

    const pricingTiers = [
        {
            name: 'Starter',
            price: '₹1199',
            desc: 'For growing single-location excellence.',
            features: ['Up to 3 Managed Locations', 'Smart Email Integration', 'Core Analytics Dashboard', 'Standard 12hr Support']
        },
        {
            name: 'Professional',
            price: '₹5499',
            desc: 'The industry standard for restaurant groups.',
            features: ['Up to 15 Managed Locations', 'Full Triage System', 'Real-time Collab Rooms', 'Priority 2hr SLA Support'],
            featured: true
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            desc: 'Unrivaled power for global chains.',
            features: ['Unlimited Location Scaling', 'Custom AI Support Training', 'SLA Guarantees for Uptime', 'Dedicated Technical Account Manager']
        }
    ];

    return (
        <div className="light-marketing landing-page">
            <nav className="landing-topbar" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', width: '100%', maxWidth: 'none', transform: 'none', left: '0', position: 'fixed' }}>
                <div className="landing-brand" style={{ marginLeft: '40px' }} onClick={() => navigate('/')}>RestroBoard</div>
                <div className="landing-top-actions" style={{ marginRight: '40px' }}>
                    <button className="landing-btn" style={{ background: 'transparent' }} onClick={() => navigate('/')}>Back</button>
                </div>
            </nav>

            <section ref={welcomeSectionRef} className="pricing-hero">
                <div className="animate-float" style={{ color: 'var(--primary)', marginBottom: '24px' }}>
                    <Layers size={56} strokeWidth={1} />
                </div>
                <h1 className="landing-title" style={{ fontSize: '4.2rem', maxWidth: '900px', color: '#0f172a', letterSpacing: '-3px' }}>Luxury Architecture for High-Performance Dining</h1>
                <p className="landing-section-subtitle" style={{ fontSize: '1.4rem', maxWidth: '700px', opacity: 0.9 }}>
                    Invest in the synergy of elite engineering and professional hospitality operations.
                </p>
                <div className="pricing-cta-row">
                    <button className="landing-btn landing-btn-dark btn-medium" onClick={() => setShowExperience(true)}>
                        The VIP Experience <ArrowRight size={20} />
                    </button>
                    <button className="landing-btn landing-btn-accent btn-medium" onClick={scrollToLead}>
                        View Investment Plans
                    </button>
                </div>
            </section>

            {/* Experience Modal */}
            {showExperience && (
                <div className="experience-modal-overlay">
                    <div className="experience-modal-card">
                        <button style={{ position: 'absolute', top: '48px', right: '48px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }} onClick={() => setShowExperience(false)}>
                            <X size={40} />
                        </button>

                        <div style={{ textAlign: 'left', paddingBottom: '40px' }}>
                            <div style={{ color: 'var(--primary)', marginBottom: '20px' }}>{features[experienceIndex].icon}</div>
                            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '20px', letterSpacing: '-1.5px', color: '#000', lineHeight: 1.1 }}>{features[experienceIndex].title}</h2>
                            <p style={{ fontSize: '1.15rem', color: 'var(--text-dim)', lineHeight: '1.6', fontWeight: '400', maxWidth: '650px' }}>{features[experienceIndex].desc}</p>
                        </div>

                        <div className="modal-nav-btn" onClick={() => setExperienceIndex((prev) => (prev + 1) % features.length)}>
                            <ArrowRight size={32} />
                        </div>

                        <div className="modal-footer-stats">
                            <span style={{ color: '#000' }}>{experienceIndex + 1} / {features.length}</span> — Strategic Advantage Deep Dive
                        </div>
                    </div>
                </div>
            )}

            <section className="landing-section">
                <div className="section-head">
                    <h2 className="landing-section-title">Investment Strategy</h2>
                    <p className="landing-section-subtitle">Scalable infrastructure tailored to your restaurant group's volume.</p>
                </div>
                <div className="pricing-grid">
                    {pricingTiers.map((tier, i) => (
                        <div key={i} className={`pricing-card ${tier.featured ? 'featured' : ''}`}>
                            <h3 style={{ fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-1.5px', color: '#0f172a' }}>{tier.name}</h3>
                            <p style={{ color: 'var(--text-dim)', marginTop: '8px', fontWeight: '500', fontSize: '1.1rem' }}>{tier.desc}</p>
                            <div className="price-tag" style={{ color: '#0f172a' }}>{tier.price}<span style={{ fontSize: '1.5rem', marginLeft: '8px', color: '#94a3b8', opacity: 0.6 }}>{tier.price !== 'Custom' ? '/mo' : ''}</span></div>
                            <ul className="feature-list" style={{ listStyle: 'none', padding: 0 }}>
                                {tier.features.map((f, j) => (
                                    <li key={j} style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontWeight: '600' }}>
                                        <div style={{ color: '#10b981' }}><Check size={24} strokeWidth={3} /></div> {f}
                                    </li>
                                ))}
                            </ul>
                            <button className={`landing-btn ${tier.featured ? 'landing-btn-dark' : 'landing-btn-outline'}`} style={{ width: '100%', justifyContent: 'center', padding: '24px' }} onClick={scrollToLead}>
                                {tier.price === 'Custom' ? 'Contact Advisory' : 'Initiate Trial'}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section" ref={leadFormRef} style={{ scrollMarginTop: '120px' }}>
                <div className="landing-form">
                    <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                        <Mail size={80} style={{ color: 'var(--primary)', marginBottom: '32px' }} />
                        <h2 style={{ fontSize: '3.5rem', fontWeight: '900', marginBottom: '24px', letterSpacing: '-2px' }}>Secure Your Architecture</h2>
                        <p className="landing-section-subtitle">Schedule a consultation and receive your high-fidelity onboarding package.</p>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); feedbackMutation.mutate({ name: 'VIP Lead', email, message: 'Strategic Inquiry from Marketing Flow' }); }} className="lead-capture-form">
                        <input className="landing-input" type="email" placeholder="executive.name@group.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        <button className="landing-btn landing-btn-accent" type="submit" style={{ padding: '24px 60px' }}>
                            Get my intro <ArrowRight size={24} />
                        </button>
                    </form>
                    {statusMessage && <p style={{ marginTop: '40px', color: '#10b981', fontWeight: '900', fontSize: '1.4rem', textAlign: 'center' }}>{statusMessage}</p>}
                </div>
            </section>

            <footer style={{ padding: '120px 60px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="landing-brand">RestroBoard</div>
                <div style={{ display: 'flex', gap: '48px', color: 'var(--text-dim)', fontSize: '1.1rem', fontWeight: '700' }}>
                    <span>Strategy</span>
                    <span>Privacy</span>
                    <span>Systems Status</span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontWeight: '700' }}>
                    &copy; {new Date().getFullYear()} RestroBoard Global Advisory.
                </div>
            </footer>
        </div>
    );
};

export default ProductInfo;
