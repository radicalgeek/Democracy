using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Caching;
using System.Web.Mvc;
using System.Web.Optimization;
using System.Web.Routing;
using Democracy.Bills;
using Ninject;

namespace Democracy
{
    public class MvcApplication : System.Web.HttpApplication
    {
        private static CacheItemRemovedCallback OnCacheRemove;
        private static HttpContext _context;

        protected void Application_Start()
        {
            AreaRegistration.RegisterAllAreas();
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            BundleConfig.RegisterBundles(BundleTable.Bundles);

            _context = HttpContext.Current;
           // AddTask("DataUpdateDailyTask", 0);

        }

        private void AddTask(string name, int seconds)
        {
            OnCacheRemove = new CacheItemRemovedCallback(CacheItemRemoved);
            HttpRuntime.Cache.Insert(name, seconds, null, 
                DateTime.Now.AddSeconds(seconds), Cache.NoSlidingExpiration,
                CacheItemPriority.NotRemovable, OnCacheRemove);
        }

        public void CacheItemRemoved(string taskName, object seconds, CacheItemRemovedReason removalReason)
        {

            var billsService = (IDataUpdaterService)DependencyResolver.Current.GetService(typeof(IDataUpdaterService));

            billsService.UpdateBillData(_context);


                AddTask(taskName, Convert.ToInt32(86400));
        }

    }
}
