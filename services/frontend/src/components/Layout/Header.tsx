'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { 
  Bars3Icon, 
  BellIcon, 
  UserCircleIcon,
  GlobeAltIcon,
  SunIcon,
  MoonIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { Menu, Transition, Switch } from '@headlessui/react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { NotificationDropdown } from './NotificationDropdown';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';
import { LanguageSelector } from './LanguageSelector';

interface HeaderProps {
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard' },
    { name: t('nav.farms'), href: '/farms' },
    { name: t('nav.analytics'), href: '/analytics' },
    { name: t('nav.marketplace'), href: '/marketplace' },
  ];

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left section */}
          <div className="flex items-center">
            <button
              type="button"
              className="p-2 rounded-md text-gray-400 lg:hidden hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
              onClick={onMenuToggle}
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center ml-2 lg:ml-0">
              <img
                className="h-8 w-auto"
                src="/logo.svg"
                alt="KrishiMitra"
              />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
                KrishiMitra
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden lg:ml-8 lg:flex lg:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Center section - Search */}
          <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-start">
            <div className="max-w-lg w-full lg:max-w-xs">
              <SearchBar />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>

            {/* Language selector */}
            <LanguageSelector />

            {/* Notifications */}
            <NotificationDropdown />

            {/* User menu */}
            <UserMenu user={user} onLogout={logout} />
          </div>
        </div>
      </div>
    </header>
  );
};
