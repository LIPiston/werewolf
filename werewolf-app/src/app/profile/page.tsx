'use client';

import { useState } from 'react';
import { useProfile } from '@/lib/ProfileContext';
import { uploadAvatar, updateProfileName } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import PlayerAvatar from '@/components/PlayerAvatar';

export default function ProfilePage() {
  const { profile, setProfile, isLoading } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newName, setNewName] = useState(profile?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const router = useRouter();

  if (isLoading) return <p>Loading profile...</p>;
  if (!profile) {
    router.push('/');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadAvatar(profile.id, formData);
      setProfile({ ...profile, avatar_url: result.avatar_url });
    } catch (uploadError) {
      setError('Upload failed. Please ensure the file is an image and under 8MB.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleNameChange = async () => {
    if (!newName.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    if (newName === profile.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const updatedProfile = await updateProfileName(profile.id, newName);
      setProfile(updatedProfile);
      setIsEditingName(false);
    } catch (err) {
      setError("Failed to update name.");
    }
  };

  return (
    <div className="container mx-auto p-4 text-white">
      <Link href="/" className="text-blue-500 hover:underline mb-4 block">← Back to Home</Link>
      <h1 className="text-3xl font-bold mb-4">{profile.name}&apos;s Profile</h1>
      <div className="flex items-center space-x-4 mb-6">
        <PlayerAvatar profile={profile} width={96} height={96} />
        <div>
          <h2 className="text-xl">Upload New Avatar</h2>
          <input type="file" onChange={handleFileChange} className="mb-2" />
          <button onClick={handleUpload} disabled={isUploading || !file} className="bg-blue-500 px-4 py-2 rounded">
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Change Name</h2>
        {isEditingName ? (
          <div className="flex space-x-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="p-2 rounded-lg bg-gray-700 text-white border border-gray-600 flex-grow"
            />
            <button onClick={handleNameChange} className="px-4 py-2 bg-green-600 rounded-lg">Save</button>
            <button onClick={() => {
              setIsEditingName(false);
              setNewName(profile.name);
            }} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setIsEditingName(true)} className="px-4 py-2 bg-blue-500 rounded-lg">Change Name</button>
        )}
      </div>
      <div>
        <h2 className="text-2xl font-bold">Stats</h2>
        <p>Games Played: {profile.stats.games_played}</p>
        <p>Wins: {profile.stats.wins}</p>
        <p>Losses: {profile.stats.losses}</p>
        <h3 className="text-xl font-bold mt-2">Roles Played</h3>
        <p>Werewolf: {profile.stats.roles.werewolf}</p>
        <p>God: {profile.stats.roles.god}</p>
        <p>Villager: {profile.stats.roles.villager}</p>
      </div>
    </div>
  );
}