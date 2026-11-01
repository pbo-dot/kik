import { UpdateBanner } from './UpdateBanner';
import { Day, Days } from './screens/Days';
import { FindView } from './screens/FindView';
import { Home } from './screens/Home';
import { More } from './screens/More';
import { TabBar, useRoute } from './ui';

export default function App() {
  const [page, arg] = useRoute();
  let view;
  let tab = '';
  if (page === 'fund' && arg) view = <FindView key={arg} id={arg} />;
  else if (page === 'dag' && arg) { view = <Day key={arg} day={arg} />; tab = 'dage'; }
  else if (page === 'dage') { view = <Days />; tab = 'dage'; }
  else if (page === 'soeg') { view = <Days key={arg} q={arg ?? ''} />; tab = 'dage'; }
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
