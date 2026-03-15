import { z } from 'zod';

/**
 * Validation Middleware
 * Returns a middleware function that validates req.body against a Zod schema.
 */
export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        console.error('[Validation Error]', error);

        // ZodError issues are stored in .errors or .issues
        const issues = error.issues || error.errors || [];
        const details = issues.length > 0
            ? issues.map(err => ({
                path: err.path.join('.'),
                message: err.message
            }))
            : [{ path: 'unknown', message: error.message }];

        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details
        });
    }
};

// -- SCHEMAS --

export const ticketSchema = z.object({
    ticketId: z.string().uuid().optional(),
    displayId: z.string().min(3).max(50),
    agentId: z.string().min(1),
    issueType: z.enum(['FOH', 'BOH', 'KIOSK', 'other']),
    description: z.string().min(5).max(1000),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'PENDING_CUSTOMER', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED', 'REOPENED']).default('OPEN'),
    // ...
}).passthrough(); // Simplified for now

export const ticketUpdateSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'PENDING_CUSTOMER', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED', 'REOPENED']).optional(),
    description: z.string().min(5).max(1000).optional(),
    resolution: z.string().optional(),
    rejectionReason: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
});

// ...

export const topSolutionApplySchema = z.object({
	solution: z.string().min(12).max(2000)
});

export const solutionFeedbackSchema = z.object({
	rating: z.number().min(1).max(3),
	notes: z.string().optional()
});


export const ticketCollaboratorAddSchema = z.object({
    collaboratorAgentId: z.string().min(1)
});

export const ticketCollaboratorRemoveSchema = z.object({
    collaboratorAgentId: z.string().min(1)
});

export const sessionEventSchema = z.object({
    sessionID: z.string().min(1), // Relaxed from .uuid() to just .min(1)
    agentId: z.string().min(1),
    clockInTime: z.number().optional().nullable(),
    clockOutTime: z.number().optional().nullable(),
    breaks: z.array(z.object({
        breakIn: z.number(),
        breakOut: z.number().optional().nullable()
    })).optional().nullable(),
    onCall: z.boolean().optional().nullable(),
    status: z.string().optional().nullable(),
    type: z.string().optional().nullable() // Keep optional just in case
}).passthrough(); // Allow extra fields without failing

export const authSchema = z.object({
    id: z.string().min(2),
    password: z.string().min(4)
});

export const publicFeedbackSchema = z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    category: z.enum(['general', 'feature', 'bug', 'support']).default('general'),
    message: z.string().min(10).max(2000)
});
