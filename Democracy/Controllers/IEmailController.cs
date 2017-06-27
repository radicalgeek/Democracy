using ActionMailer.Net.Mvc;
using Democracy.Services.Contracts.ViewModels;

namespace Democracy.Controllers
{
    public interface IEmailController
    {
        EmailResult ContactUs(ContactFormViewModel model);
    }
}