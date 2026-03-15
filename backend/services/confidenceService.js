import Ticket from '../models/Ticket.js';

/**
 * Compute confidence score (0-100) for a given solution text.
 * Uses all tickets where solutionFeedback.suggestedSolution matches,
 * blending customer and agent ratings.
 *
 * Rating conversion: ⭐=0, ⭐⭐=50, ⭐⭐⭐=100
 * Customer ratings weighted 1.0, agent ratings weighted 0.7
 */
function ratingToScore(rating) {
    if (rating === 3) return 100;
    if (rating === 2) return 50;
    if (rating === 1) return 0;
    return null;
}

export async function computeConfidence(solutionText) {
    if (!solutionText || solutionText.length < 10) return 0;

    const normalizedKey = solutionText.toLowerCase().trim();

    const tickets = await Ticket.find({
        'solutionFeedback.suggestedSolution': { $exists: true, $ne: null },
        $or: [
            { 'solutionFeedback.customerRating': { $ne: null } },
            { 'solutionFeedback.agentRating': { $ne: null } }
        ]
    }, {
        'solutionFeedback.suggestedSolution': 1,
        'solutionFeedback.customerRating': 1,
        'solutionFeedback.agentRating': 1,
        'solutionFeedback.customerResolvedViaEmail': 1
    }).lean();

    let totalWeight = 0;
    let weightedSum = 0;

    for (const t of tickets) {
        const fb = t.solutionFeedback;
        if (!fb?.suggestedSolution) continue;
        if (fb.suggestedSolution.toLowerCase().trim() !== normalizedKey) continue;

        // Customer feedback (strongest signal)
        const cScore = ratingToScore(fb.customerRating);
        if (cScore !== null) {
            // Bonus if customer also clicked resolve
            const weight = fb.customerResolvedViaEmail ? 1.2 : 1.0;
            weightedSum += cScore * weight;
            totalWeight += weight;
        }

        // Agent feedback
        const aScore = ratingToScore(fb.agentRating);
        if (aScore !== null) {
            weightedSum += aScore * 0.7;
            totalWeight += 0.7;
        }
    }

    if (totalWeight === 0) return 0;

    const raw = weightedSum / totalWeight;
    return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Batch-compute confidence for multiple solution texts.
 * Returns a Map<lowercasedText, confidenceScore>
 */
export async function computeConfidenceBatch(solutionTexts = []) {
    if (!solutionTexts.length) return new Map();

    const tickets = await Ticket.find({
        'solutionFeedback.suggestedSolution': { $exists: true, $ne: null },
        $or: [
            { 'solutionFeedback.customerRating': { $ne: null } },
            { 'solutionFeedback.agentRating': { $ne: null } }
        ]
    }, {
        'solutionFeedback.suggestedSolution': 1,
        'solutionFeedback.customerRating': 1,
        'solutionFeedback.agentRating': 1,
        'solutionFeedback.customerResolvedViaEmail': 1
    }).lean();

    // Build accumulator per solution text
    const accum = new Map();
    const targetKeys = new Set(solutionTexts.map(t => t.toLowerCase().trim()));

    for (const t of tickets) {
        const fb = t.solutionFeedback;
        if (!fb?.suggestedSolution) continue;
        const key = fb.suggestedSolution.toLowerCase().trim();
        if (!targetKeys.has(key)) continue;

        if (!accum.has(key)) accum.set(key, { weightedSum: 0, totalWeight: 0 });
        const entry = accum.get(key);

        const cScore = ratingToScore(fb.customerRating);
        if (cScore !== null) {
            const w = fb.customerResolvedViaEmail ? 1.2 : 1.0;
            entry.weightedSum += cScore * w;
            entry.totalWeight += w;
        }

        const aScore = ratingToScore(fb.agentRating);
        if (aScore !== null) {
            entry.weightedSum += aScore * 0.7;
            entry.totalWeight += 0.7;
        }
    }

    const result = new Map();
    for (const [key, entry] of accum) {
        if (entry.totalWeight === 0) {
            result.set(key, 0);
        } else {
            result.set(key, Math.round(Math.min(100, Math.max(0, entry.weightedSum / entry.totalWeight))));
        }
    }

    return result;
}
