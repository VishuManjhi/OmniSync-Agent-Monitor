import PublicFeedback from '../models/PublicFeedback.js';

const HELP_CONTENT = {
    faqs: [
        {
            question: 'How are tickets automatically assigned to agents?',
            answer: 'Email tickets are intelligently triaged and assigned using a weighted assignment algorithm that considers agent availability, current workload, and cooldown periods. The system ensures fair distribution while prioritizing urgent tickets based on category weights (FOH, BOH, KIOSK).'
        },
        {
            question: 'What is the collaborative ticket room feature?',
            answer: 'Ticket rooms allow multiple agents to collaborate on complex issues in real-time. The primary agent maintains ownership and resolution authority, while secondary collaborators can contribute solutions, chat, and provide expertise without disrupting the accountability chain.'
        },
        {
            question: 'How do Top 3 Solutions help agents resolve tickets faster?',
            answer: 'Our AI-powered system analyzes historical tickets with similar descriptions and issue types, suggesting the top 3 most successful resolutions. Agents can review these proven solutions and send them directly to customers, dramatically reducing resolution time for common issues.'
        },
        {
            question: 'Can supervisors monitor team performance in real-time?',
            answer: 'Yes! Supervisors have access to a comprehensive dashboard showing live agent status, Average Handle Time (AHT), SLA compliance rates, ticket queues, and performance metrics. They can also force logout agents, create priority tickets, and run SLA automation workflows.'
        },
        {
            question: 'How does the team structure work?',
            answer: 'RestroBoard supports team-based organization where supervisors manage groups of agents (e.g., Team 1: agents 1-10, Team 2: agents 11-20). This enables better workload management, focused supervision, and team-specific performance tracking.'
        },
        {
            question: 'What happens if my inbound email doesn\'t create a ticket?',
            answer: 'Check your webhook configuration, verify the shared token/signature settings match your email provider, and ensure your backend server is publicly accessible. Review the email ingest service logs for any parsing or validation errors.'
        },
        {
            question: 'Can template replies fail even after being selected?',
            answer: 'Yes. While template rendering may succeed internally, your email provider may still reject delivery due to domain restrictions, SPF/DKIM configuration, rate limits, or account status issues. Check your provider\'s delivery logs for specific errors.'
        },
        {
            question: 'Why can\'t I update ticket status in a collaborative ticket?',
            answer: 'Only the primary agent (ticket owner) can perform status transitions like resolving or rejecting tickets. This design maintains clear accountability and audit trails while still allowing secondary collaborators to contribute through chat and solution suggestions.'
        },
        {
            question: 'How are SLA breaches handled automatically?',
            answer: 'The SLA automation system monitors ticket age and escalates overdue items based on configurable thresholds. Supervisors can manually trigger automation runs or let scheduled jobs handle escalations, with detailed breach reports available in the automation panel.'
        },
        {
            question: 'What is the async job queue used for?',
            answer: 'Background jobs handle resource-intensive operations like bulk report generation, email notifications, data exports, and scheduled maintenance tasks without blocking the main application. The job queue provides status tracking, retry logic, and failure handling.'
        }
    ],
    caseStudies: [
        {
            title: 'Quick-Service Restaurant Chain: 40% Faster Kiosk Issue Resolution',
            summary: 'A  multi-location quick-service chain reduced average kiosk outage resolution time from 45 minutes to 27 minutes by leveraging historical solution suggestions. The Top 3 Solutions feature provided agents with proven fixes instantly, eliminating trial-and-error troubleshooting during peak hours.'
        },
        {
            title: 'Family Dining Group: 85% SLA Compliance Through Smart Assignment',
            summary: 'A nationwide family dining franchise improved SLA compliance from 62% to 85% in 3 months using weighted triage and intelligent agent assignment. The system automatically balanced workload across shifts and prioritized FOH issues during lunch/dinner rushes, preventing queue bottlenecks.'
        },
        {
            title: 'Multi-Brand Operator: Unified Support Across 50+ Locations',
            summary: 'A restaurant group managing 5 brands across 50 locations consolidated support operations into RestroBoard. Team-based supervisor assignment enabled brand-specific expertise while email-to-ticket automation eliminated manual ticket entry, reducing administrative overhead by 60%.'
        },
        {
            title: 'Fast-Casual Chain: Real-Time Collaboration Cuts Escalations by 55%',
            summary: 'Implementing collaborative ticket rooms allowed junior agents to get instant expert help on complex BOH equipment issues. Senior staff could join tickets remotely, share guidance through chat, and resolve problems without on-site visits - reducing issue escalations from 40% to 18%.'
        },
        {
            title: 'Enterprise Restaurant Group: Data-Driven Performance Improvement',
            summary: 'Advanced analytics dashboards gave supervisors visibility into agent AHT, resolution patterns, and performance trends. By identifying training gaps and optimizing agent schedules based on ticket volume patterns, they increased first-contact resolution rates by 32%.'
        }
    ]
};

export const getHelpContent = async (req, res, next) => {
    try {
        res.json({ ok: true, ...HELP_CONTENT });
    } catch (err) {
        next(err);
    }
};

export const submitFeedback = async (req, res, next) => {
    try {
        const payload = req.body || {};
        const created = await PublicFeedback.create({
            name: payload.name,
            email: payload.email,
            category: payload.category,
            message: payload.message,
            source: 'landing_page'
        });

        res.status(201).json({ ok: true, id: created._id });
    } catch (err) {
        next(err);
    }
};
