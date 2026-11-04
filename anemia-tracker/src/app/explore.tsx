import { Redirect } from 'expo-router';

// Preserve old starter-template links while keeping users in the real app.
export default function LegacyExploreRedirect() {
  return <Redirect href="/" />;
}
