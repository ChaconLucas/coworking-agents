'use strict';
// after the code link: continue on this address, keeping the #fragment. A navigation started here counts as same-site,
// so the strict cookie just set goes along (a redirect after a link from another site, like the notices page, would not)
location.replace('/' + location.hash);
