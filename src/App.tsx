import { Suspense, lazy } from 'react';
import { UpdateBanner } from './UpdateBanner';
import { Day, Days } from './screens/Days';
import { FindView } from './screens/FindView';
import { Home } from './screens/Home';
import { More } from './screens/More';
import { TabBar, useRoute } from './ui';

// Kortet er tungt, så det hentes først, når man skal bruge det
const Kort = lazy(() => import('./screens/Kort'));

export default function App() {
  const [page, arg] = useRoute();
  let view;
  let tab = '';
  if (page === 'fund' && arg) view = <FindView key={arg} id={arg} />;
  else if (page === 'dag' && arg) { view = <Day key={arg} day={arg} />; tab = 'dage'; }
  else if (page === 'dage') { view = <Days />; tab = 'dage'; }
  else if (page === 'soeg') { view = <Days key={arg} q={arg ?? ''} />; tab = 'dage'; }
  else if (page === 'kort' || page === 'retur') view = <Suspense fallback={<main className="page" />}><Kort key={page} back={page === 'retur'} /></Suspense>;
  else if (page === 'mere') { view = <More />; tab = 'mere'; }
  else view = <Home />;
  return (
    <>
      <UpdateBanner />
      {view}
      <TabBar active={tab} />
    </>
  );
}
