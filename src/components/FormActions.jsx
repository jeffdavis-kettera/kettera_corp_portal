// FormActions — standard Cancel + primary submit pair.
// Fresh copy of Navigator's helper.

export default function FormActions({
  onCancel,
  cancelText = 'Cancel',
  submitText = 'Save',
  submittingText = 'Saving…',
  isSubmitting = false,
  disableSubmit = false,
}) {
  return (
    <div className="form-actions">
      <button type="button" className="cancel-button" onClick={onCancel} disabled={isSubmitting}>
        {cancelText}
      </button>
      <button type="submit" className="save-button" disabled={isSubmitting || disableSubmit}>
        {isSubmitting ? submittingText : submitText}
      </button>
    </div>
  );
}
