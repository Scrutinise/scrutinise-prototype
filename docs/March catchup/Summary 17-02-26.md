# Conversation Summary: Reputation System Design

## Conversation Metadata

-   **First Claude Reply**: 17-02-26; 00:00
-   **Last Claude Reply**: 17-02-26; 00:15
-   **Total Claude Replies**: 3
-   **Conversation Title**: PageRank-Style Reputation & Multi-Dimensional Voting System Design

## Build Process Stage

**Database Schema Design & Backend Architecture** - Core platform mechanics for user reputation and contribution quality assessment

## Areas Covered

1.  **PageRank-Style Reputation Systems**
    -   Weighted voting where voter reputation affects vote impact
    -   Circular dependency handling in reputation calculations
    -   Three implementation approaches (Simple Weighted, Iterative PageRank, Hybrid)
2.  **Multi-Dimensional Voting Architecture**
    -   Vote categories separating quality metrics from opinion agreement
    -   Anti-pile-on protection mechanisms
    -   Groupthink prevention strategies
3.  **Database Schema Design**
    -   Vote categories table structure
    -   Contribution votes with reputation snapshots
    -   Reputation score calculation and storage
4.  **Gaming Resistance Mechanisms**
    -   Logarithmic dampening for mob voting
    -   Median-based vote weighting
    -   Contrarian protection for unpopular but high-quality contributions
    -   Bridge-building bonuses for cross-partisan support

## Decisions Made

### Core Architecture Decisions

1.  **Vote System**: Multi-category voting system (NOT simple up/down)
    -   Categories: Clarity, Evidence-based, Constructive, Civil tone
    -   Users vote on quality dimensions, not opinion agreement
2.  **Anti-Pile-On Protection**: Implement logarithmic dampening
    -   First 5 votes count fully, diminishing returns thereafter
    -   Prevents mob downvoting from burying quality contributions
3.  **Vote Weighting Method**: Median-based reputation weighting
    -   Uses median voter reputation in each direction
    -   More resistant to sock puppet attacks than simple sum
4.  **Implementation Phases**:
    -   **Phase 1 (MVP)**: Multi-category voting + median-based weighting + logarithmic dampening
    -   **Phase 2 (Post-launch)**: Add contrarian protection and bridge-building bonuses after analyzing real voting patterns

### Database Schema

5.  **Vote Categories Table**: Separate table for vote category definitions
6.  **Contribution Votes Table**: Track individual votes with voter reputation snapshot at time of vote
7.  **Reputation Scores Table**: Store calculated scores per category plus bonuses

## Issues Discussed But Not Concluded

### Open Questions Requiring Future Decisions

1.  **Exact Number of Vote Categories**: 4-5 categories recommended to avoid decision fatigue, but specific final list not determined
2.  **Downvote Permissions**: Whether users can downvote at all vs. only "not upvote" - trade-off between quality control and preventing negative pile-ons
3.  **Vote Anonymity**: Whether votes should be anonymous to contribution authors to reduce retaliation voting
4.  **Reputation Decay**: Whether inactive users should lose reputation influence over time
5.  **Category Weight Multipliers**: Whether some categories (e.g., "evidence-based") should be weighted more heavily than others (e.g., "civil tone")
6.  **UI Design**: Actual voting interface design not mocked up yet

### Educational/Background Information Provided

1.  **PageRank Algorithm Basics**: How Google's algorithm handles circular dependencies through iterative calculation
2.  **Cold Start Problem**: How to handle new users with no reputation history (suggestion: base reputation of 10 points)
3.  **Implementation Complexity Trade-offs**:
    -   Simple weighted sum = easy, real-time, but not true PageRank
    -   Iterative PageRank = complex, batch processing, but handles circular dependencies
    -   Hybrid approach = best of both worlds
4.  **Contrarian Bonus Concept**: Protecting minority expert opinions when most votes are negative but high-reputation users vote positive
5.  **Bridge-Building Bonus Concept**: Rewarding contributions that unite people with opposing voting histories
6.  **Vote Weighting Approaches**:
    -   Simple sum (rich get richer)
    -   Highest-only (first mover advantage)
    -   Median-based (most robust)

## Next Steps (Implied)

1.  Finalize vote category list (4-5 categories)
2.  Decide on downvote policy
3.  Determine category weight multipliers
4.  Design voting UI mockup
5.  Implement database schema for multi-dimensional voting
6.  Build calculation logic for reputation scores
7.  Plan A/B testing strategy for post-launch algorithm tuning
