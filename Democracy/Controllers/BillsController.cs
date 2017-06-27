using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Democracy.Bills;
using Democracy.Services.Contracts.ViewModels;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;

namespace Democracy.Controllers
{
    public class BillsController : Controller
    {
        private IBillsService _billsService;
        private IVoteService _voteService;
        private IConstituencyService _constituencyService;
        private ApplicationUserManager _userManager;

        public ApplicationUserManager UserManager
        {
            get
            {
                return _userManager ?? HttpContext.GetOwinContext().GetUserManager<ApplicationUserManager>();
            }
            private set
            {
                _userManager = value;
            }
        }

        
        public BillsController(IBillsService billsService,IVoteService voteService, IConstituencyService constituencyService)
        {
            _billsService = billsService;
            _voteService = voteService;
            _constituencyService = constituencyService;
        }

        [Authorize]
        [OutputCache(Duration = 3600)]
        public ActionResult Index()
        {
            var model = _billsService.GetAllBills();
            return View(model);
        }

        [Authorize]
       // [OutputCache(Duration = 3600,VaryByParam = "id")]
        public ActionResult Details(int id)
        {
            var userId = System.Web.HttpContext.Current.User.Identity.GetUserId();
            var model = _billsService.GetBill(id, userId);
            return View(model);
        }

        [Authorize]
        [OutputCache(Duration = 3600, VaryByParam = "id")]
        public ActionResult ParliamentaryDebate(int id)
        {
            var model = _billsService.ParliamentaryDebatesForBill(id);
            return View(model);
        }

        [Authorize]
        public ActionResult VoteOnBill(bool vote, int billId)
        {
            var userId = System.Web.HttpContext.Current.User.Identity.GetUserId();
            var user = _constituencyService.GetUserWithConstituency(userId);
            var constituency = user.ConstituencyDataModel;
            if (user.IsIdentityVerified)
            {
                _voteService.RegisterVoteForBill(vote, billId, constituency);
            }
            else
            {
                _voteService.RegisterOpinionForBill(vote, billId, constituency);    
            }
            
            _voteService.RegisterUserParticipation(billId, userId);
            return RedirectToAction("Details", new {id = billId});
        }

        [Authorize]
        public ActionResult SetPoliticalStance(PoliticalStanceViewModel model)
        {
            var userId = System.Web.HttpContext.Current.User.Identity.GetUserId();

            _billsService.SetBillStance(model.VerticalAvarage, model.HorizontalAvarage, model.BillId, userId);

            return RedirectToAction("Details", new { id = model.BillId });
        }

        [Authorize]
        [OutputCache(Duration = 3600, VaryByParam = "id")]
        public ActionResult ExplainStance()
        {
            return View();
        }

      //  [OutputCache(Duration = 3600, VaryByParam = "id")]
        public ActionResult VoteOnStance(int id)
        {
            var userId = System.Web.HttpContext.Current.User.Identity.GetUserId();
            var billStance = _billsService.GetPoliticalStance(id, userId);
            return View(billStance);
        }
    }
}