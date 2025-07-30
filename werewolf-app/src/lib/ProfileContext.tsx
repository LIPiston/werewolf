'use client';

import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { getProfile } from './api';

interface ProfileStats {
  games_played: number;
  wins: number;
  losses: number;
  roles: {
    werewolf: number;
    god: number;
    villager: number;
  };
}

interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  stats: ProfileStats;
}

interface ProfileContextType {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      const storedProfileId = localStorage.getItem('profile_id');
      if (storedProfileId) {
        try {
          const profileData = await getProfile(storedProfileId);
          setProfile(profileData);
        } catch (error) {
          console.error("Failed to load profile, clearing stored ID.", error);
          localStorage.removeItem('profile_id');
        }
      }
      setIsLoading(false);
    };

    loadProfile();
  }, []);

  const handleSetProfile = useCallback((newProfile: Profile | null) => {
    setProfile(newProfile);
    if (newProfile) {
      localStorage.setItem('profile_id', newProfile.id);
    } else {
      localStorage.removeItem('profile_id');
    }
  }, []);

  const value = useMemo(() => ({
    profile,
    setProfile: handleSetProfile,
    isLoading
  }), [profile, isLoading, handleSetProfile]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
