import { X } from "lucide-react";
import { HelpTopic } from "../lib/help";
import { markHelpViewedGlobal } from "../lib/useHelpTracking";
import { useEffect } from "react";

type HelpModalProps = {
  topic: HelpTopic;
  onClose: () => void;
};

export function HelpModal({ topic, onClose }: HelpModalProps) {
  useEffect(() => {
    markHelpViewedGlobal(topic.id);
  }, [topic.id]);

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <div>
            <h2>{topic.title}</h2>
            <p className="muted">{topic.shortDesc}</p>
          </div>
          <button className="help-close" onClick={onClose} aria-label="Close help">
            <X size={20} />
          </button>
        </div>

        <div className="help-modal-content">
          {typeof topic.content === "string" ? (
            <p>{topic.content}</p>
          ) : (
            topic.content
          )}
        </div>

        {topic.readTime && (
          <div className="help-modal-footer">
            <span className="muted">⏱ {topic.readTime} min read</span>
          </div>
        )}
      </div>
    </div>
  );
}
