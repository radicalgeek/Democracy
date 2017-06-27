using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using ActionMailer.Net.Mvc;
using Democracy.Services.Contracts.ViewModels;

namespace Democracy.Controllers
{
    public class EmailController : MailerBase, IEmailController
    {
        // GET: Email
        public ActionResult Index()
        {
            return View();
        }

        public EmailResult ContactUs(ContactFormViewModel model)
        {
            try
            {
                To.Add("mark@radicalgeek.co.uk");
                //To.Add("aradicalgeek@googlemail.com");
                From = "feedback@democracy.radicalgeek.co.uk";
                Subject = "Democracy Contact form message";
                return Email("ContactUs", model);
            }
            catch (Exception ex)
            {
                throw;
            }
        }
    }
}