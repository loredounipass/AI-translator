import { useState } from "react";
import { supabase } from "utils/supabaseClient";
import { useAuth } from "contexts/AuthContext";
import { showSuccessToast, showErrorToast } from "components/AppNotifications";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BASE_INPUT_CLASSES = "w-full py-2.5 rounded-lg glass-input text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors";

const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setSubject("");
    setMessageText("");
    setSending(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      showErrorToast("Error", "You must be signed in to send feedback");
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = messageText.trim();

    if (!trimmedFirstName || !trimmedSubject || !trimmedMessage) {
      showErrorToast("Error", "Please fill in all required fields");
      return;
    }

    setSending(true);

    const sanitizeHtml = (str: string) => str.replace(/<[^>]*>?/gm, '');

    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        first_name: sanitizeHtml(trimmedFirstName),
        last_name: sanitizeHtml(lastName.trim()),
        phone: phone.trim(),
        email: user.email || "",
        subject: sanitizeHtml(trimmedSubject),
        message: sanitizeHtml(trimmedMessage),
      });

      if (error) throw error;

      showSuccessToast("Success", "Thank you for your feedback!");
      handleClose();
    } catch (err) {
      showErrorToast("Error", "Error sending feedback. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 glass-overlay z-[65] transition-opacity duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="glass-modal rounded-2xl w-full max-w-md overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Leave Feedback
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your feedback helps us improve.
            </p>

            <div className="relative flex-1">
              <input
                type="email"
                value={user?.email || ""}
                readOnly
                className={`${BASE_INPUT_CLASSES} pl-3 pr-3 opacity-70 cursor-not-allowed`}
                title="Your email is automatically included"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name *"
                  className={`${BASE_INPUT_CLASSES} pl-3 pr-3`}
                  autoComplete="given-name"
                  required
                  minLength={2}
                />
              </div>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className={`${BASE_INPUT_CLASSES} pl-3 pr-3`}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Phone (optional)"
                className={`${BASE_INPUT_CLASSES} pl-3 pr-3`}
                autoComplete="tel"
              />
            </div>

            <div className="relative">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject *"
                className={`${BASE_INPUT_CLASSES} pl-3 pr-3`}
                required
              />
            </div>

            <div className="relative">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Message *"
                rows={4}
                className={`${BASE_INPUT_CLASSES} pl-3 pr-3 resize-none`}
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <FeedbackIcon />
              {sending ? "Sending..." : "Send Feedback"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default FeedbackModal;
