import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  isDemoRouteAllowed,
  readSetupJourney,
  saveSetupJourney,
  type SetupJourney,
} from '../../services/setupJourney';
import GlassLoader from '../ui/GlassLoader';
import LazyLoadBoundary from '../common/LazyLoadBoundary';
import { useDeviceAppearance } from './OnboardingGlass';

import { useI18n } from '../../i18n/I18nProvider';

const loadOnboardingExperience = () => import('./OnboardingExperience');
const OnboardingExperience = React.lazy(() =>
  loadOnboardingExperience().then((module) => ({ default: module.OnboardingExperience })),
);
const DemoLockedRoute = React.lazy(() =>
  loadOnboardingExperience().then((module) => ({ default: module.DemoLockedRoute })),
);
const DashboardPage = React.lazy(() => import('../../pages/Home'));

export function isSetupRoute(pathname: string) {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return normalized === '/setup' || normalized.startsWith('/setup/');
}

export function shouldForceCompletedConfiguration(
  pathname: string,
  phase: SetupJourney['phase'],
  search = '',
) {
  if (!isSetupRoute(pathname) || phase !== 'done') return false;
  return new URLSearchParams(search).get('reconnect') === '1';
}

function DashboardLoading() {
  const appearance = useDeviceAppearance();
  const { t } = useI18n();
  return (
    <div
      className={`apple-bg-main flex min-h-[100dvh] items-center justify-center ${
        appearance === 'light' ? 'dashboard-theme-light' : 'dashboard-theme-dark'
      }`}
    >
      <GlassLoader
        size="lg"
        label={t('route.loading.title')}
        description={t('route.loading.description')}
      />
    </div>
  );
}

export function ExperienceGate() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [journey, setJourney] = useState<SetupJourney>(() => {
    return readSetupJourney(window.localStorage, {
      embedded: window.parent !== window,
    });
  });
  const handleJourneyChange = useCallback((next: SetupJourney) => setJourney(next), []);
  const setupRoute = isSetupRoute(location.pathname);
  const forceConfiguration = shouldForceCompletedConfiguration(
    location.pathname,
    journey.phase,
    location.search,
  );

  useEffect(() => {
    if (journey.phase === 'done' && journey.mode === 'demo' && location.pathname === '/') {
      navigate('/home', { replace: true });
    }
  }, [journey.mode, journey.phase, location.pathname, navigate]);

  if (journey.phase !== 'done' || (setupRoute && forceConfiguration)) {
    return (
      <LazyLoadBoundary fallback={<DashboardLoading />}>
        <OnboardingExperience
          journey={journey}
          onJourneyChange={handleJourneyChange}
          forceConfiguration={forceConfiguration}
        />
      </LazyLoadBoundary>
    );
  }

  if (journey.mode === 'demo' && !isDemoRouteAllowed(location.pathname)) {
    return (
      <LazyLoadBoundary fallback={<DashboardLoading />}>
        <DemoLockedRoute
          pathname={location.pathname}
          onConnect={() => {
            const embedded = window.parent !== window;
            const next = saveSetupJourney({
              phase: 'discover',
              mode: 'real',
              connectionMethod: embedded ? 'panel' : 'direct',
            }, window.localStorage);
            setJourney(next);
            navigate('/setup');
          }}
        />
      </LazyLoadBoundary>
    );
  }

  return (
    <LazyLoadBoundary fallback={<DashboardLoading />}>
      <DashboardPage />
    </LazyLoadBoundary>
  );
}

export default ExperienceGate;
