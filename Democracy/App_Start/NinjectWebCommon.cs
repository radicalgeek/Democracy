using System.Data.Entity;
using Democracy.Bills;
using Democracy.Controllers;
using Democracy.Data;
using Democracy.Data.Interfaces;
using Democracy.Data.Repositories;

[assembly: WebActivatorEx.PreApplicationStartMethod(typeof(Democracy.App_Start.NinjectWebCommon), "Start")]
[assembly: WebActivatorEx.ApplicationShutdownMethodAttribute(typeof(Democracy.App_Start.NinjectWebCommon), "Stop")]

namespace Democracy.App_Start
{
    using System;
    using System.Web;

    using Microsoft.Web.Infrastructure.DynamicModuleHelper;

    using Ninject;
    using Ninject.Web.Common;

    public static class NinjectWebCommon 
    {
        private static readonly Bootstrapper bootstrapper = new Bootstrapper();

        /// <summary>
        /// Starts the application
        /// </summary>
        public static void Start() 
        {
            DynamicModuleUtility.RegisterModule(typeof(OnePerRequestHttpModule));
            DynamicModuleUtility.RegisterModule(typeof(NinjectHttpModule));
            bootstrapper.Initialize(CreateKernel);
        }
        
        /// <summary>
        /// Stops the application.
        /// </summary>
        public static void Stop()
        {
            bootstrapper.ShutDown();
        }
        
        /// <summary>
        /// Creates the kernel that will manage your application.
        /// </summary>
        /// <returns>The created kernel.</returns>
        private static IKernel CreateKernel()
        {
            var kernel = new StandardKernel();
            try
            {
                kernel.Bind<Func<IKernel>>().ToMethod(ctx => () => new Bootstrapper().Kernel);
                kernel.Bind<IHttpModule>().To<HttpApplicationInitializationHttpModule>();

                RegisterServices(kernel);
                return kernel;
            }
            catch
            {
                kernel.Dispose();
                throw;
            }
        }

        /// <summary>
        /// Load your modules or register your services here!
        /// </summary>
        /// <param name="kernel">The kernel.</param>
        private static void RegisterServices(IKernel kernel)
        {
            kernel.Bind<DbContext>().To<DataContext>();
            kernel.Bind<IDataUpdaterService>().To<DataUpdaterService>();
            kernel.Bind<IBillsService>().To<BillsService>();
            kernel.Bind<IConstituencyService>().To<ConstituencyService>();
            kernel.Bind<IVoteService>().To<VoteService>();
            kernel.Bind<IRssClient>().To<RssClient>();
            kernel.Bind<IDatabaseRepository>().To<DatabaseRepository>();
            kernel.Bind<IDebatesService>().To<DebatesService>();
            kernel.Bind<IUserService>().To<UserService>();
            kernel.Bind<IEmailController>().To<EmailController>();
        }        
    }
}
