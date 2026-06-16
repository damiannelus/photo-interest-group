export function checkCanPost(text: string, submitting: boolean): boolean {
  return text.trim().length >= 10 && !submitting;
}

export function checkCanSubmit(
  photoUrl: string,
  reflection: string,
  submitting: boolean
): boolean {
  return (
    photoUrl.trim().length > 0 &&
    reflection.trim().length >= 50 &&
    !submitting
  );
}

export function checkCanFollowUp(
  hasUser: boolean,
  photoUrl: string,
  reflection: string,
  submitting: boolean
): boolean {
  return (
    hasUser &&
    photoUrl.trim().length > 0 &&
    reflection.trim().length >= 50 &&
    !submitting
  );
}

export function checkCanEdit(reflection: string, submitting: boolean): boolean {
  return reflection.trim().length >= 50 && !submitting;
}
