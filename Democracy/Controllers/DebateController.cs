using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using Democracy.Bills;
using Democracy.Models;
using Microsoft.Ajax.Utilities;
using Microsoft.AspNet.Identity;

namespace Democracy.Controllers
{
    public class DebateController : Controller
    {
        private IDebatesService _debateService;

        public DebateController(IDebatesService debateService)
        {
            _debateService = debateService;
        }
        
        [Authorize]
        //[OutputCache(Duration = 3600, VaryByParam = "billId")]
        public ActionResult PeoplesDebate(int billId)
        {
            var model = _debateService.GetPeoplesDebatesByBill(billId);

            return View(model);
        }

        [Authorize]
        public ActionResult NewComment(string newComment, string billId)
        {
            var user = System.Web.HttpContext.Current.User.Identity.GetUserId();
            _debateService.AddPeoplesComment(user, newComment, billId);
            return RedirectToAction("PeoplesDebate", new {billId});
        }
    }
}