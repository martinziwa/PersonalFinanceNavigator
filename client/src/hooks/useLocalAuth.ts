import { useState, useEffect } from 'react';
import { localStorageManager } from '@/lib/localStorage';
import type { User } from '@shared/schema';

export function useLocalAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize local user
    const initializeUser = () => {
      try {
        let existingUser = localStorageManager.getUser();
        
        if (!existingUser) {
          // Create a default local user
          existingUser = localStorageManager.upsertUser({
            id: 'local_user',
            email: 'user@local.device',
            firstName: 'Local',
            lastName: 'User',
            profileImageUrl: null,
          });
        }
        
        setUser(existingUser);
      } catch (error) {
        console.error('Error initializing local user:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeUser();
  }, []);

  const updateUser = (userData: Partial<User>) => {
    if (!user) return null;
    
    try {
      const updatedUser = localStorageManager.upsertUser({
        id: user.id,
        email: userData.email ?? user.email,
        firstName: userData.firstName ?? user.firstName,
        lastName: userData.lastName ?? user.lastName,
        profileImageUrl: userData.profileImageUrl ?? user.profileImageUrl,
      });
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    updateUser,
  };
}