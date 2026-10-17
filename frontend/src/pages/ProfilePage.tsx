// Profile page — step 1. Creates or edits the dietary restriction profile.

import { ProfileForm } from "@components/ProfileForm";
import { PersistentNote } from "@components/PersistentNote";
import { profileSummary, useProfile } from "@state/profileStore";

export function ProfilePage({ onContinue }: { onContinue: () => void }) {
  const { profile } = useProfile();

  return (
    <div className="page page-profile">
      <section className="profile-intro">
        <h1>Your dietary profile</h1>
        <p className="lede">
          Tell LabelLens what to watch out for. It stays in this browser and is
          never sent anywhere, not to our service and not to any vision
          provider.
        </p>
        <p className="chip chip-accent profile-summary-chip">
          {profileSummary(profile)}
        </p>
      </section>

      <section className="profile-sheet" aria-label="Profile settings">
        <ProfileForm onSaved={onContinue} />
      </section>

      <PersistentNote />
    </div>
  );
}
