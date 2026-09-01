import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { reviewsAPI } from "../api";
import ReviewSummary from "../components/reviews/ReviewSummary";
import ReviewCard from "../components/reviews/ReviewCard";

function buildSubmittedReviewSummary(userId, reviews) {
  const avg = (key) => {
    const values = reviews
      .map((review) => review[key])
      .filter((value) => value != null);

    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  };

  return {
    user_id: userId,
    total_reviews: reviews.length,
    avg_overall: avg("overall_rating"),
    avg_punctuality: avg("punctuality"),
    avg_work_quality: avg("work_quality"),
    avg_communication: avg("communication"),
    avg_attitude: avg("attitude"),
  };
}

export default function Reviews() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !role) return;
      setLoading(true);
      setError("");
      try {
        if (role === "employer") {
          const reviewsRes = await reviewsAPI.getMySubmittedReviews(1, 50);
          const submittedReviews = reviewsRes.data?.reviews || [];
          setReviews(submittedReviews);
          setSummary(buildSubmittedReviewSummary(user.id, submittedReviews));
        } else {
          const [summaryRes, reviewsRes] = await Promise.all([
            reviewsAPI.getReviewSummary(user.id),
            reviewsAPI.getUserReviews(user.id, 1, 50),
          ]);
          setSummary(summaryRes.data);
          setReviews(reviewsRes.data?.reviews || []);
        }
      } catch (err) {
        setError(err?.response?.data?.detail || "Failed to load reviews.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role, user?.id]);

  const isEmployer = role === "employer";
  const title = isEmployer ? "Reviews You've Given" : "Your Ratings & Reviews";
  const description = isEmployer
    ? "This page shows reviews you submitted for workers after completed jobs."
    : "This page shows ratings and feedback employers gave you after completed jobs.";
  const summaryRole = isEmployer ? "worker" : role;
  const listTitle = isEmployer ? "Reviews Given" : "Recent Reviews";
  const emptyText = isEmployer ? "No reviews submitted yet." : "No reviews yet.";
  const profileLinkLabel = isEmployer ? "Open My Jobs" : "Open Profile";
  const profileLinkTarget = isEmployer ? "/jobs" : "/profile";

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Reviews</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {description}
            </p>
          </div>
          <Link
            to={profileLinkTarget}
            className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
          >
            {profileLinkLabel}
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
            <p className="mt-4 text-sm font-medium text-slate-600">Loading reviews...</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                {isEmployer ? "Given Reviews Summary" : "Rating Summary"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Average score and breakdown.</p>
              <div className="mt-4">
                <ReviewSummary summary={summary} userRole={summaryRole} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-900">{listTitle}</h2>
              </div>
              {reviews.length > 0 ? (
                <div className="space-y-3 p-5">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} showReviewee={isEmployer} />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-sm text-slate-500">{emptyText}</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
