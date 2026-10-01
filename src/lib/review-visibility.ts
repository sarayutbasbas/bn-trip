export function hasSubmittedReview(item?: { rating: unknown; review: string | null }) {
  const rating = Number(item?.rating);
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 && Boolean(item?.review?.trim());
}

export function visibleTripReviews<T extends { is_current_user: boolean; rating: string | null; review: string | null; updated_at: string | null }>(rows: T[]) {
  const scoresVisible = hasSubmittedReview(rows.find(row => row.is_current_user));
  const ratings = rows.map(row => Number(row.rating)).filter(rating => rating >= 1 && rating <= 5);
  return {
    scoresVisible,
    items: rows.map(row => !scoresVisible && !row.is_current_user ? { ...row, rating: null, review: null, updated_at: null } : row),
    average: scoresVisible && ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10 : 0,
    count: scoresVisible ? ratings.length : 0,
  };
}

// Callers bind the current session user as $1; never interpolate a user ID.
export const submittedReviewSql = (alias: string) => `EXISTS (SELECT 1 FROM trip_reviews own_review WHERE own_review.trip_id=${alias}.id AND own_review.user_id=$1 AND own_review.rating BETWEEN 1 AND 5 AND length(btrim(own_review.review))>0)`;
