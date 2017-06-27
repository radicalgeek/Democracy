using System.Web;
using System.Web.Optimization;

namespace Democracy
{
    public class BundleConfig
    {
        // For more information on bundling, visit http://go.microsoft.com/fwlink/?LinkId=301862
        public static void RegisterBundles(BundleCollection bundles)
        {
            bundles.Add(new ScriptBundle("~/bundles/jquery").Include(
                        "~/Scripts/jquery-{version}.js"));

            bundles.Add(new ScriptBundle("~/bundles/jquery-ui").Include(
            "~/Scripts/jquery-ui-1.11.4.js",
            "~/Scripts/jquery.ui.widget.js"));

            bundles.Add(new ScriptBundle("~/bundles/jqueryval").Include(
                        "~/Scripts/jquery.validate*"));

            // Use the development version of Modernizr to develop with and learn from. Then, when you're
            // ready for production, use the build tool at http://modernizr.com to pick only the tests you need.
            bundles.Add(new ScriptBundle("~/bundles/modernizr").Include(
                        "~/Scripts/modernizr-*"));

            bundles.Add(new ScriptBundle("~/bundles/bootstrap").Include(
                      "~/Scripts/bootstrap.js",
                      "~/Scripts/respond.js"));

            bundles.Add(new ScriptBundle("~/bundles/upload").Include(
                        "~/Scripts/jquery.fileupload.js",
                        "~/Scripts/jquery.iframe-transport.js"));

            bundles.Add(new ScriptBundle("~/bundles/markdown").Include(
                        "~/Scripts/MarkdownDeep.js",
                        "~/Scripts/MarkdownDeepEditor.js",
                        "~/Scripts/MarkdownDeepEditorUI.js"));

            bundles.Add(new StyleBundle("~/Content/css").Include(
                      "~/Content/bootstrap.css",
                      "~/Content/site.css"));

            bundles.Add(new StyleBundle("~/Content/jquery-ui").Include(
                "~/Content/jquery-ui.css",
                "~/Content/jquery-ui.structure.css",
                "~/Content/jquery-ui.theme"));

            bundles.Add(new StyleBundle("~/Content/markdown").Include(
                      "~/Scripts/mdd_styles.css"));

            bundles.Add(new StyleBundle("~/Content/upload").Include(
                      "~/Content/jquery.fileupload-ui-noscript.css",
                      "~/Content/jquery.fileupload-ui.css"));

            // Set EnableOptimizations to false for debugging. For more information,
            // visit http://go.microsoft.com/fwlink/?LinkId=301862
            BundleTable.EnableOptimizations = true;
        }
    }
}
