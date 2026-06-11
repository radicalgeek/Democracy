import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { getHelpTopic } from "../lib/help";
import { HelpModal } from "./HelpModal";

type HelpTriggerProps = {
  topicId: string;
  label?: string;
  children?: React.ReactNode;
  inline?: boolean;
};

export function HelpTrigger({
  topicId,
  label,
  children,
  inline = false
}: HelpTriggerProps) {
  const [showModal, setShowModal] = useState(false);
  const topic = getHelpTopic(topicId);

  if (!topic) return null;

  const displayLabel = label || topic.title;

  if (inline) {
    return (
      <>
        <button
          className="help-trigger-inline"
          onClick={() => setShowModal(true)}
          title={`Learn about: ${topic.title}`}
          aria-label={`Learn about: ${topic.title}`}
        >
          {children || <HelpCircle size={16} />}
        </button>
        {showModal && <HelpModal topic={topic} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        className="help-trigger"
        onClick={() => setShowModal(true)}
        title={`Learn about: ${topic.title}`}
        aria-label={`Learn about: ${topic.title}`}
      >
        <HelpCircle size={16} />
        <span>{displayLabel}</span>
      </button>
      {showModal && <HelpModal topic={topic} onClose={() => setShowModal(false)} />}
    </>
  );
}
