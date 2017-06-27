using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using System.Xml;
using System.Xml.Linq;
using Democracy.ActionResults;
using Democracy.Bills;
using Democracy.Filters;
using Democracy.Services.Contracts.ViewModels;

namespace Democracy.Controllers
{
    public class HomeController : Controller
    {
        private IBillsService _billsService;
        public HomeController(IBillsService buiService)
        {
            _billsService = buiService;
        }

        public ActionResult Index()
        {
            return RedirectToAction("Statistics");
        }

        [Authorize]
        [OutputCache(Duration = 500)]
        public async Task<ActionResult> Statistics()
        {
            
            var stats = await _billsService.GetStatistics();
            return View(stats);
        }

        [OutputCache(Duration = 3600)]
        public ActionResult About()
        {
            ViewBag.Message = "Your application description page.";

            return View();
        }

        [OutputCache(Duration = 3600)]
        public ActionResult Contact()
        {
            ViewBag.Message = "Your contact page.";

            return View();
        }

        [OutputCache(Duration = 3600)]
        [HttpPost]
        public ActionResult Contact(ContactFormViewModel model)
        {
            try
            {
                var mailController = (IEmailController)DependencyResolver.Current.GetService(typeof(IEmailController));
                mailController.ContactUs(model).Deliver();
                return RedirectToAction("ThankYou");
            }
            catch (Exception ex)
            {
                ModelState.AddModelError("Error", ex.Message);
                return View("Error");
            }

        }

        public ActionResult ThankYou()
        {
            return View();
        }

        [Compress]
        public XmlResult StatsMap()
        {
            var mapSvgFile = new XmlDocument();

            //mapSvgFile.Load(Server.MapPath("~/Content/Images/map.svg"));
            var result = XDocument.Load(Server.MapPath("~/Content/Images/map.svg"));

            //var constituencDetails = _billsService.GetConstituentyVoteDetails();
            //foreach (var constituencyViewModel in constituencDetails.Result)
            //{
            //     var name = constituencyViewModel.Name.Replace("(", "").Replace(")", "").Replace(',', '_').Replace(' ', '_');
            //        var stance = "nutural";
            //        var highCount = 0;

            //        if (constituencyViewModel.AuthoriterianLeftVotesFor > constituencyViewModel.AuthoriterianRightVotesFor) {
            //            stance = "AL";
            //            highCount = constituencyViewModel.AuthoriterianLeftVotesFor;
            //        }
            //        if (constituencyViewModel.AuthoriterianLeftVotesFor < constituencyViewModel.AuthoriterianRightVotesFor) {
            //            stance = "AR";
            //            highCount = constituencyViewModel.AuthoriterianRightVotesFor;
            //        }
            //        if (constituencyViewModel.LibeterianLeftVotesFor > constituencyViewModel.LibeterianRightVotesFor && constituencyViewModel.LibeterianLeftVotesFor > highCount) {
            //            stance = "LL";
            //            highCount = constituencyViewModel.LibeterianLeftVotesFor;
            //        }
            //        if (constituencyViewModel.LibeterianLeftVotesFor < constituencyViewModel.LibeterianRightVotesFor && constituencyViewModel.LibeterianRightVotesFor > highCount) {
            //            stance = "LR";
            //            highCount = constituencyViewModel.LibeterianRightVotesFor;
            //        }
            //    XElement element = result.Elements("path").First(el => (string) el.Attribute("id") == name);
            //    element.Attribute("class").SetValue(stance + " seat");
            //}

            return new XmlResult(result);
        }
    }
}